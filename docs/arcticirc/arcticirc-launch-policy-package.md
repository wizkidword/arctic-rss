# ArcticIRC Launch Policy Package

**Owner-decision draft**
**Prepared:** July 14, 2026
**Applies to:** Arctic RSS and the ArcticIRC beta

This package gives Codex the product-policy decisions and publication-ready wording needed to finish the legal, privacy, cookie, security, retention, deletion, and community-guidelines work for ArcticIRC.

The publication date shown on the live pages must be the actual deployment date. Do not publish bracketed placeholders. Reuse the legal and security contact address already configured on arcticrss.com unless the owner has configured a dedicated replacement.

This is a practical launch package, not a guarantee of compliance in every jurisdiction. Public chat and third-party IRC access create meaningful legal and safety obligations; professional legal review remains advisable before a broad international launch.

---

# 1. Owner-approved launch decisions

Codex should treat the following as product requirements and policy source of truth.

## 1.1 Eligibility

- The Arctic RSS reader remains available only to people age 13 or older.
- ArcticIRC, including native Arctic rooms and access to external IRC networks, is available only to people age 18 or older during the beta.
- Do not collect a full date of birth. Require a one-time account-level attestation that the user is at least 18 before activating ArcticIRC.
- Record only the policy version, timestamp, account ID, and acceptance result.
- If Arctic learns that an ArcticIRC user is under 18, suspend chat access and remove the chat profile in accordance with the deletion policy.
- The owner may revisit the age threshold only after child-safety, moderation, age-assurance, and jurisdiction-specific requirements have been reviewed.

## 1.2 Native Arctic room visibility

- Room names, descriptions, topics, tags, language, and approximate activity counts may be visible without an account.
- Native message transcripts are not shown to guests and are not indexed by search engines during the beta.
- A signed-in, eligible user may see messages in a public native room after opening or joining that room.
- A user's chat handle, current presence, room role, and messages may be visible to other people with access to that room.
- Email addresses, RSS subscription lists, real names, account IDs, IP addresses, blocks, reports, and moderation notes are never displayed to ordinary users.

## 1.3 Native message retention

- Native Arctic room messages are retained for 90 days from creation and then automatically deleted from primary systems.
- When a message is deleted by a user or moderator, its visible body is removed promptly and no later than 24 hours from primary systems.
- A content-free tombstone may remain until the original 90-day expiry so message ordering and moderation history remain coherent.
- A restricted evidence copy may be retained only when the message is attached to a report, safety investigation, legal hold, or active appeal.
- Native chat content is not used to train AI systems or generate AI summaries.

## 1.4 Reports, moderation, and audit retention

- Open reports and their evidence are retained while the case is active, with stale open cases reviewed at least every 90 days so they do not remain open without a documented reason.
- Closed ordinary reports, moderator notes, and necessary evidence are retained for 12 months after final closure.
- Evidence concerning credible threats, stalking, doxxing, exploitation, fraud, coordinated abuse, repeat ban evasion, or a reasonably anticipated legal claim may be retained for up to 24 months after closure.
- Arctic must not intentionally preserve illegal sexual-exploitation material beyond what is necessary to comply with applicable reporting, preservation, and law-enforcement obligations.
- Moderator action and administrative audit logs are retained for 24 months.
- Access is limited to authorized personnel with a legitimate moderation, security, or legal need.

## 1.5 Presence and activity retention

- Typing indicators expire after approximately 10 seconds and are not stored as history.
- Presence records expire no later than 2 minutes after the last valid heartbeat or disconnect grace period.
- Ordinary join, leave, connection, and gateway diagnostic metadata is retained for 30 days.
- Current memberships, favorites, blocks, notification settings, and room preferences remain until the user changes them or deletes the account.
- Historical membership metadata that is no longer needed is deleted within 30 days after leaving a room, unless attached to an active moderation case.

## 1.6 Operational, security, analytics, and backup retention

- Standard application, gateway, reverse-proxy, and delivery logs are retained for 30 days.
- Security events, abuse signals, authentication anomalies, and incident evidence are retained for 90 days, or for 12 months after a confirmed incident is closed when narrowly necessary for investigation and prevention.
- Live rate-limit counters expire within 24 hours unless promoted into a documented security incident.
- Rolling backups are retained for no more than 30 days.
- Deleted data must not be restored for ordinary product use. If a backup is restored for disaster recovery, deletion and retention jobs must be rerun before normal service resumes.
- Optional analytics may run only after affirmative consent. Event-level analytics retention is 14 months.
- Analytics must not contain message bodies, report content, private room names, chat handles, IRC credentials, raw RSS subscription lists, or external IRC message content.
- Aggregated statistics that no longer identify a person may be kept longer.

## 1.7 External IRC data

- External IRC message bodies are session-only for the beta.
- Arctic does not persist external IRC message bodies on the server, in backups, in analytics, or in searchable history.
- Browser transcripts are cleared when the relevant session or tab is closed, the user signs out, or the browser session ends.
- Arctic does not store SASL, NickServ, or other external-network passwords during the beta. Credentials are held in memory only for the active connection and cleared on disconnect.
- Arctic may retain the user's selected network, nickname, username, real-name field, favorites, and autojoin preferences until the user removes them or deletes the account.
- External-network connection and error metadata follows the 30-day standard-log and 90-day security-log periods above.
- The ArcticIRC 18+ rule applies to Arctic account holders using ArcticIRC. It does not guarantee that people encountered on an external IRC network are adults.
- Remote networks, channel operators, bots, and participants may independently receive, copy, log, or retain messages and connection information. Arctic cannot erase third-party copies.
- Before the first connection to each external network, show a network-specific notice describing the network, applicable rules, connection method, and whether the user's IP address or other connection metadata may be disclosed.

## 1.8 Personalized discovery

- Arctic may recommend native rooms and approved external channels using topics attached to feeds the user follows, topics the user expressly selected, rooms the user joined or favorited, language preferences, and aggregate room-quality signals.
- Do not use the text of private messages, report content, or raw article-reading history for recommendations.
- Do not disclose a user's RSS subscriptions or recommendation profile to room owners, other users, advertisers, or external IRC networks.
- Provide a setting to disable personalized room recommendations. Non-personalized search and discovery must remain available.

## 1.9 Cookies and analytics

- Strictly necessary authentication, security, CSRF, connection, and preference technologies may operate without optional analytics consent.
- Google Analytics or any replacement analytics service must not load until the user affirmatively accepts optional analytics.
- “Accept optional analytics” and “Necessary only” must be equally clear and easy to select.
- Declining analytics must not reduce access to the reader or chat.
- Store the consent choice for 180 days or until the policy materially changes, whichever comes first.
- No advertising cookies, cross-context behavioral advertising, fingerprinting, or sale of personal information.
- Configure optional analytics for measurement only: disable advertising features, Google Signals, ad personalization, user-ID transmission, and unnecessary provider data sharing where those controls exist.
- Chat connection tokens and external IRC credentials must remain in memory and must not be placed in URLs, local storage, analytics, or ordinary logs.

## 1.10 Account deletion

- Provide a self-service account-deletion request where practical and retain the existing email request path.
- Verify the requester before deletion.
- Disable account access, revoke sessions and chat tokens, and disconnect native and external IRC sessions promptly after a verified request enters processing.
- Complete deletion from primary systems within 30 days.
- Delete the chat profile, RSS reader data, memberships, favorites, blocks, notifications, external-network profiles, stored preferences, and other account-linked data that is not subject to a documented exception.
- For native messages still inside the 90-day window, sever the account link and replace the visible author with “Deleted user” promptly. The message body remains only until its ordinary 90-day expiry unless the user identifies content that must be removed sooner under applicable law or policy.
- If a message body itself contains personal information about the deleting user, provide a way to identify the message for review and removal.
- Restricted report evidence, audit records, active sanctions, legal holds, and minimal anti-abuse records may be retained for the periods stated in this package.
- A minimal anti-abuse record for a sanctioned deleted account may be retained for up to 24 months. It must contain no message body and no more identifying information than reasonably necessary to prevent immediate ban evasion.
- Keep a minimal deletion-completion record for 24 months containing the request date, completion date, policy version, and a non-public internal reference. Do not retain the deleted account profile merely to prove deletion.
- Backup copies expire within the 30-day rolling backup period.
- Deletion cannot remove messages or records already copied by external IRC networks, other participants, bots, linked websites, or lawful recipients.

## 1.11 Legal holds and required exceptions

A published retention period may be paused for specific data when Arctic reasonably needs it to:

- comply with a valid legal obligation or court order;
- preserve evidence for an active security, abuse, fraud, or safety investigation;
- establish, exercise, or defend legal claims; or
- protect users or the public from a credible threat.

The hold must be documented, access-restricted, reviewed periodically, and released when the reason ends. Data must then return to its normal deletion schedule.

---

# 2. Replacement Terms of Service

## Terms of Service

**Last updated:** Use the actual publication date.

### 1. Acceptance

These Terms of Service govern your use of Arctic RSS, ArcticIRC, and related websites, applications, APIs, realtime services, and features operated under the Arctic name (together, the “Service”). By creating an account or using the Service, you agree to these Terms and the Privacy Policy, Cookie Policy, Community Guidelines, Retention and Deletion Policy, and Security page. If you do not agree, do not use the Service.

Additional notices may apply before you connect to a third-party IRC network. The rules and policies of that network and its channels also apply to activity on that network.

### 2. Eligibility

You must be at least 13 years old to use the Arctic RSS reader. You must be at least 18 years old to activate or use ArcticIRC, including native Arctic rooms and connections to external IRC networks.

By activating ArcticIRC, you confirm that you are at least 18 and legally able to agree to these Terms. Do not use ArcticIRC if local law prohibits you from doing so.

### 3. Accounts and chat handles

You are responsible for your account, credentials, devices, chat handle, external IRC identities, and activity performed through your account. Provide accurate account information, keep credentials secure, and notify Arctic through the contact address shown on the site if you suspect unauthorized access.

Chat handles must not impersonate another person or organization, mislead others about affiliation, infringe rights, evade enforcement, or use reserved system or staff names. Arctic may reserve, rename, or remove handles when reasonably necessary.

Your Arctic account does not create or guarantee ownership of a nickname, account, channel, or operator status on an external IRC network.

### 4. Arctic RSS and third-party feed content

Arctic RSS helps users discover, subscribe to, organize, and read third-party RSS and Atom feeds. Feed articles, images, trademarks, and linked pages belong to their publishers or other rights holders. Arctic does not control and is not responsible for the accuracy, legality, availability, security, or content of third-party feeds or sites.

Article cards shared in chat are references to third-party material. Sharing an article does not transfer ownership or imply endorsement by Arctic.

### 5. Native Arctic rooms and user content

Native Arctic rooms are spaces operated through ArcticIRC. During the beta, room metadata may be publicly discoverable, while message transcripts are available only to eligible signed-in users who access the room.

You retain any rights you hold in messages and other content you submit. You grant Arctic a non-exclusive, worldwide, royalty-free license to host, store, reproduce, transmit, format, display, moderate, and remove that content only as reasonably necessary to operate, secure, administer, and improve the Service, enforce these Terms, and comply with law. This license ends when the content is deleted from active systems, except for limited backups, restricted moderation evidence, audit records, and legal holds described in the Privacy and Retention policies.

Do not post secrets or information you cannot safely share. Other users may quote, copy, screenshot, forward, or independently retain content they can see. Arctic cannot guarantee that another person will delete a copy.

Arctic may impose message limits, slow mode, read-only mode, channel locks, visibility limits, or other safety and reliability controls.

### 6. External IRC networks

ArcticIRC may let you connect as an individual user to approved third-party IRC networks. Those networks are independent services. Their operators and channel operators control nicknames, services accounts, channel modes, invitations, kicks, bans, logging rules, and network-wide enforcement.

When you connect, the external network may receive your selected nickname, username, real-name field, channels, messages, and connection information appropriate to the approved connection method. Depending on the network and gateway arrangement, this may include your IP address or a gateway address. Arctic will show a network-specific notice before your first connection.

Arctic does not promise that an external network, channel, nickname, message, or connection will remain available. Arctic cannot override a network or channel ban and cannot delete messages or logs retained by the network, channel operators, bots, or other participants. ArcticIRC's 18+ eligibility rule applies to Arctic users; it does not mean that every person encountered on an external IRC network is an adult.

Do not use ArcticIRC to bridge rooms, operate bots, evade bans, crawl channel lists at scale, flood networks, automate unsolicited messages, or run unapproved clients through Arctic infrastructure. DCC and direct file transfer are not supported during the beta.

Never enter your Arctic password into NickServ, SASL, or another external-network service. External-network credentials are separate from your Arctic account.

### 7. Acceptable use

You must follow the Community Guidelines. You may not use the Service to:

- break the law or facilitate serious wrongdoing;
- threaten, harass, stalk, intimidate, or target another person;
- promote hatred or abuse against people based on protected or vulnerable characteristics;
- exploit, sexualize, endanger, or solicit a minor, or distribute child sexual abuse material;
- publish private or identifying information without authorization, including doxxing;
- impersonate others, misrepresent affiliation, or deceive people for harmful purposes;
- send spam, scams, phishing, malware, malicious links, or coordinated manipulation;
- infringe copyright, trademark, privacy, publicity, or other rights;
- bypass access controls, rate limits, sanctions, bans, or security protections;
- access an account, room, message, report, or system without authorization;
- overload, disrupt, probe, scrape, or automate the Service except as expressly permitted;
- collect or profile users without their knowledge and lawful authority;
- interfere with moderation or submit knowingly false or abusive reports; or
- use the Service in a way that creates unreasonable risk for Arctic, its providers, IRC networks, or other users.

### 8. Moderation and enforcement

Arctic may review reports and content reasonably necessary to enforce these Terms, protect users, investigate abuse, secure the Service, or comply with law. Arctic may remove content, limit visibility, warn, mute, kick, suspend, ban, restrict features, preserve evidence, or terminate accounts.

Moderation decisions involve context and may not be perfectly consistent. Arctic is not obligated to monitor every room or message and does not guarantee that harmful content will be prevented or removed immediately.

A user may request review of an Arctic enforcement action through the contact method provided on the site. External-network and external-channel actions must be appealed through that network or channel where applicable.

### 9. Reports and emergencies

Submit reports in good faith and include only information reasonably necessary for review. Do not knowingly submit false reports or use reporting tools to harass others.

ArcticIRC is not an emergency service. If someone is in immediate danger, contact local emergency services or an appropriate local authority. Do not rely on Arctic to monitor a room in real time.

### 10. AI features

Optional article-summary features may be incomplete, inaccurate, or omit important context. Do not rely on them as legal, financial, medical, safety, or other professional advice.

Native or external chat messages are not used for AI summaries or AI-model training under the beta policy. Arctic will update its policies before materially changing that practice.

### 11. Analytics, security, and privacy

Arctic processes account, reader, chat, moderation, technical, and security information as described in the Privacy Policy. Optional analytics are consent-based. Arctic does not sell personal information or use chat content for targeted advertising.

### 12. Voluntary tips and future paid features

Ko-fi tips are voluntary support for the project and are processed by Ko-fi. A tip is not a purchase of a subscription, support guarantee, or paid-feature entitlement. If Arctic introduces paid plans, it will publish applicable pricing, renewal, cancellation, and refund terms before charging users.

### 13. Service changes and beta availability

The Service is provided on an as-available basis. Arctic may add, change, limit, suspend, or discontinue features, rooms, networks, integrations, or the Service itself. Beta and experimental features may fail, lose state, change without notice, or be withdrawn.

Arctic may disable a third-party network or the entire external-IRC connector immediately for safety, policy, operational, or legal reasons.

### 14. Account suspension, termination, and deletion

Arctic may suspend or terminate accounts that violate these Terms, create risk, or are required to be restricted by law. Users may request account deletion through account settings where available or through the contact address shown on the site.

Deletion is handled under the Retention and Deletion Policy. Deleting an Arctic account cannot erase copies held by other users, external IRC networks, bots, feed publishers, linked sites, or lawful recipients.

### 15. Disclaimers

To the fullest extent permitted by law, the Service is provided “as is” and “as available,” without warranties of any kind, express or implied. Arctic does not warrant uninterrupted availability, perfect security, message delivery, transcript availability, feed accuracy, moderation outcomes, external-network compatibility, or preservation of any nickname, room, channel, or content.

Some jurisdictions do not allow certain warranty exclusions, so some exclusions may not apply to you.

### 16. Limitation of liability

To the fullest extent permitted by law, Arctic and its operators will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost data, lost profits, lost opportunities, feed outages, message loss, third-party content, third-party logging, external-network actions, or unavailable features arising from or related to the Service.

Nothing in these Terms excludes liability that cannot lawfully be excluded.

### 17. Changes to these Terms

Arctic may update these Terms as the Service changes. Material updates will be posted with a new effective date and, when appropriate, shown through an in-product notice. Continued use after the effective date means the updated Terms apply, except where law requires a different form of consent.

### 18. Contact

Questions about these Terms may be sent to the legal contact address currently displayed on arcticrss.com.

---

# 3. Replacement Privacy Policy

## Privacy Policy

**Last updated:** Use the actual publication date.

### 1. Overview and scope

This Privacy Policy explains how Arctic RSS and ArcticIRC collect, use, disclose, retain, and protect information. “Arctic,” “we,” and “us” refer to the operator of arcticrss.com and the Arctic services.

This policy covers the Arctic RSS reader, native ArcticIRC rooms, the ArcticIRC client and gateway, room discovery, article sharing, support, moderation, and related account services. Third-party feed publishers, linked websites, analytics providers, hosting and security providers, and external IRC networks have their own privacy practices.

Contact Arctic through the privacy or legal contact address currently displayed on arcticrss.com to ask a privacy question or exercise a privacy right.

### 2. Information Arctic collects

#### Account and identity information

Arctic may collect your email address, username, name, authentication records, OAuth identifiers, account status, chat handle, handle history needed to prevent impersonation, policy acceptances, and account settings.

ArcticIRC requires a one-time confirmation that the user is at least 18. Arctic does not need a full birth date for the beta.

#### Reader information

Arctic may collect feed URLs, folders, subscriptions, topic selections, article metadata, read state, stars, saved items, display preferences, theme, date and time settings, and related reader state.

#### Native ArcticIRC information

Arctic may collect native-room messages, article cards, room memberships, roles, join and leave events, read position, mentions, notification settings, blocks, ignores, favorites, presence, typing state, reports, moderator notes, sanctions, deleted-message tombstones, and administrative audit records.

Room names, descriptions, topics, tags, language, and approximate activity counts may be publicly visible. During the beta, native message transcripts are not shown to guests or indexed by Arctic for public search.

Other eligible users in a room can see your chat handle, messages, current presence, and room role. They cannot see your email address, raw RSS subscriptions, IP address, reports, blocks, or moderator notes through the ordinary chat interface.

#### External IRC information

When you connect to an approved external IRC network, Arctic may process the selected network, nickname, username, real-name field, channels, connection state, favorites, autojoin settings, server capabilities, error information, and the messages needed to provide the live connection.

External IRC message bodies are session-only during the beta and are not persisted by Arctic on the server, in backups, in analytics, or in searchable history. External-network credentials are held in memory only for the active connection and are cleared on disconnect.

The remote IRC network receives information needed for the IRC connection. Depending on the approved connection method, this may include your nickname, username, real-name field, message content, channels, account-services information, IP address, gateway address, and other protocol metadata. Arctic presents a network-specific notice before the first connection.

Remote networks, channel operators, bots, and participants may independently log or copy messages. Their retention and deletion practices are outside Arctic's control. ArcticIRC's 18+ rule applies to Arctic account holders and does not guarantee that remote-network participants are adults.

#### Reports, support, and communications

Arctic collects the information you provide in support requests, privacy requests, security reports, abuse reports, appeals, account-verification messages, and password-reset or account-recovery flows.

A report may contain a copy of the reported content and surrounding context so authorized moderators can assess it even if the original message is later deleted.

#### Technical and security information

Arctic may collect IP address, user agent, device and browser information, timestamps, request and connection identifiers, authentication events, rate-limit signals, gateway diagnostics, crash and error data, security events, and Cloudflare or similar security-check results.

Arctic does not intentionally place message bodies, external-network passwords, raw RSS subscription lists, or report content in ordinary application logs.

#### Optional analytics

If you affirmatively accept optional analytics, Arctic may collect page views, feature usage, referral information, device and browser characteristics, and approximate location provided by the analytics service.

Analytics must not include native or external message bodies, reports, private room names, chat handles, credentials, or raw feed-subscription lists. Declining analytics does not reduce access to the Service.

### 3. How Arctic uses information

Arctic uses information to:

- create and authenticate accounts;
- provide the RSS reader and save reader state;
- provide native rooms, messages, presence, notifications, and moderation;
- connect users to approved external IRC networks;
- recommend rooms and channels;
- share article references into chat;
- prevent spam, fraud, abuse, raids, ban evasion, and security threats;
- investigate reports, appeals, incidents, and policy violations;
- maintain reliability, diagnose bugs, and measure performance;
- provide support and account communications;
- comply with law and protect rights, safety, and the Service; and
- measure optional product usage after consent.

For users in jurisdictions that require a legal basis, Arctic generally relies on performance of the service agreement, legitimate interests in operating and securing the Service, consent for optional analytics and other optional processing where required, and legal obligations. Arctic balances legitimate interests against user rights and limits processing to what is reasonably necessary.

### 4. Room and channel discovery

Arctic may personalize room recommendations using topics attached to feeds you follow, topics you selected, rooms you joined or favorited, language preferences, and aggregate room-quality and activity signals.

Arctic does not disclose your raw subscription list or recommendation profile to room owners, other users, advertisers, or external IRC networks. You may disable personalized recommendations in settings and continue using non-personalized search and discovery.

Arctic does not use private-message text, report content, or raw article-reading history to personalize room discovery during the beta.

### 5. Public and shared information

Information you intentionally post or expose in a native room is visible to other eligible users who access that room. Your handle, room role, current presence, and messages may be visible there.

External IRC messages are visible to participants and systems on the remote network according to that network's protocol, channel settings, bots, and policies. Other people may screenshot, quote, forward, or independently retain information. Do not post information you cannot safely share.

### 6. How Arctic discloses information

Arctic may disclose information:

- to hosting, database, email, authentication, analytics, security, content-delivery, monitoring, and support providers that process information for Arctic;
- to other users when you post in a room or expose profile and presence information through the product;
- to authorized moderators and administrators when needed to review reports, enforce rules, or secure the Service;
- to an external IRC network when you choose to connect;
- to feed publishers when Arctic servers fetch public feeds or related resources;
- to legal authorities or other recipients when reasonably necessary to comply with law, respond to valid process, protect safety, investigate abuse, or defend legal claims; and
- in connection with a merger, acquisition, financing, reorganization, or transfer of the Service, subject to appropriate notice and safeguards.

Arctic does not sell personal information. Arctic does not use chat content for targeted advertising and does not knowingly disclose personal information for cross-context behavioral advertising.

### 7. Third-party services

Arctic uses third-party services to operate the product, which may include Google OAuth, transactional email delivery, optional Google Analytics, Cloudflare hosting, DNS, security, Turnstile, and email routing, Ko-fi for voluntary tips, infrastructure and monitoring providers, feed publishers, and approved IRC networks.

These providers process information under their own terms and privacy notices. Arctic limits the information sent to them to what is reasonably needed for the relevant function.

### 8. AI features

If you request an article summary, Arctic may process the selected article content, title, source, and related metadata to generate the summary. Article-summary features may involve a third-party AI provider as disclosed in the product or an updated policy.

Native and external chat messages are not used for AI summaries or AI-model training during the beta. Arctic will update this policy and product controls before materially changing that practice.

### 9. Cookies and browser storage

Arctic uses necessary cookies and similar technologies for authentication, security, CSRF protection, connection handling, consent choices, and preferences. Optional analytics technologies run only after affirmative consent.

Chat connection tokens and external IRC credentials are not stored in URLs or persistent browser storage. See the Cookie Policy for more information and controls.

### 10. Retention

Arctic follows the Retention and Deletion Policy. Key periods include:

- native room messages: 90 days;
- ordinary closed reports and evidence: 12 months after closure;
- serious safety or legal evidence: up to 24 months after closure;
- moderation and administrative audit logs: 24 months;
- standard operational logs: 30 days;
- security logs: 90 days, with limited incident evidence retained longer when necessary;
- event-level optional analytics: 14 months;
- rolling backups: no more than 30 days; and
- external IRC message bodies: session-only and not persisted by Arctic during the beta.

A legal hold or active safety, abuse, fraud, or security investigation may temporarily extend a period for specifically identified information. Holds are documented, restricted, reviewed, and released when no longer needed.

### 11. Account deletion

You may request deletion through account settings where available or through the contact address shown on the site. Arctic verifies the request, disables access and active sessions promptly, and completes deletion from primary systems within 30 days.

Account and reader data, the chat profile, memberships, favorites, blocks, notifications, external-network profiles, and other ordinary account-linked data are deleted unless a documented exception applies.

For native messages still within the 90-day retention window, Arctic severs the account link and displays the author as “Deleted user.” The message body then expires on its ordinary schedule. You may identify a message for earlier review when its body contains personal information about you or another policy or legal basis requires removal.

Restricted moderation evidence, audit records, legal holds, active sanctions, minimal anti-abuse records, and a minimal deletion-completion record may remain for the limited periods stated in the Retention and Deletion Policy.

Backup copies expire within 30 days. Deletion cannot erase information already copied or retained by other users, external IRC networks, channel operators, bots, linked websites, feed publishers, or lawful recipients.

### 12. Your choices and rights

You may update account and reader settings, leave rooms, remove favorites, change notification settings, block or ignore users, disable personalized discovery, and decline optional analytics.

You may contact Arctic to request access, correction, export, deletion, restriction, or objection where applicable. Arctic may need to verify your identity and may retain limited information where law permits or requires it. Arctic responds within the period required by applicable law.

You may withdraw analytics consent at any time through the cookie or privacy settings. Withdrawal does not affect processing that occurred before withdrawal.

### 13. International processing

Arctic and its service providers may process information in the United States and other countries. Those countries may have different privacy laws. Where required, Arctic uses appropriate contractual or legal safeguards for international transfers.

Connecting to an external IRC network may send information to servers and participants in countries selected or used by that network.

### 14. Children and age limits

The Arctic RSS reader is not intended for children under 13. ArcticIRC is not available to anyone under 18 during the beta.

If Arctic learns that it collected account information from a child under 13, or that a person under 18 activated ArcticIRC, Arctic will take reasonable steps to restrict the relevant access and delete or handle the information according to applicable law and this policy.

### 15. Security

Arctic uses administrative, technical, and organizational safeguards designed for the nature of the Service. No online service is perfectly secure. Use a strong unique password or a trusted OAuth provider, protect your email account, and report suspected account compromise promptly.

See the Security page for vulnerability-reporting instructions.

### 16. Changes

Arctic may update this Privacy Policy as the Service changes. Material changes will be posted with a new effective date and, when appropriate, presented through an in-product notice.

### 17. Contact

Privacy questions and rights requests may be sent to the privacy or legal contact address currently displayed on arcticrss.com.

---

# 4. Replacement Cookie Policy

## Cookie Policy

**Last updated:** Use the actual publication date.

### 1. Overview

This Cookie Policy explains how Arctic uses cookies and similar technologies, including local storage, session storage, and security tokens, on Arctic RSS and ArcticIRC.

Arctic uses necessary technologies to provide requested features and protect the Service. Optional analytics run only after affirmative consent. Arctic does not use advertising cookies, cross-context behavioral-advertising tags, or fingerprinting.

### 2. Necessary technologies

Necessary cookies and similar technologies may be used to:

- keep you signed in;
- protect forms and APIs from CSRF and replay attacks;
- issue and validate short-lived chat connection tokens;
- maintain secure account, reader, and chat sessions;
- remember a cookie-consent choice;
- perform Cloudflare or similar anti-abuse and security checks;
- route requests and maintain reliability; and
- remember settings needed to provide a feature you requested.

Blocking necessary technologies may prevent login, account recovery, chat connection, security checks, or other core features from working.

Chat connection tokens are short-lived and remain in memory where technically possible. External IRC passwords are not stored in cookies, URLs, local storage, or analytics.

### 3. Preference storage

Arctic may store preferences such as theme, layout, message-density choice, sound settings, date and time format, time zone, room-list state, and accessibility options.

Persistent preferences should expire or be refreshed no later than 12 months after the last use. Unsent chat-message drafts are session-only during the beta and are cleared at sign-out or when the browser session ends.

### 4. Optional analytics

Arctic may use Google Analytics or a replacement service to understand aggregate traffic and product use. Optional analytics do not load until you select “Accept optional analytics.” Selecting “Necessary only” provides full access to the reader and chat without optional analytics.

Analytics events must not contain native or external chat message bodies, report content, private room names, chat handles, external IRC credentials, or raw feed-subscription lists. Event-level analytics retention is 14 months.

You can withdraw consent through the cookie or privacy settings. Arctic stores the consent choice for 180 days or until the policy materially changes, whichever comes first.

### 5. Security services

Arctic uses Cloudflare security services and Turnstile or similar tools to reduce spam, automated abuse, and attacks. These services may set or read security tokens that are necessary to complete a check or maintain a secure session.

### 6. External links and IRC networks

ArcticIRC connects to external IRC networks through Arctic infrastructure or a network-approved endpoint. Arctic does not embed third-party advertising technology in the chat transcript.

When you open a third-party website from a feed or chat link, that site may use its own cookies and tracking technologies. Its policies apply to that visit.

### 7. Cookie inventory

The live Cookie Policy must include a table generated from the actual production inventory with these columns:

- name or key;
- provider;
- category;
- purpose;
- storage type;
- maximum duration; and
- whether optional consent is required.

Codex must inspect the production code and configuration and list the actual names. It must not invent cookie names or claim a duration that does not match the deployed setting.

Approved maximums are:

- authentication and secure session state: session duration or up to 30 days when the user expressly chooses a persistent sign-in;
- CSRF, socket, and short-lived security state: session duration or shorter;
- consent choice: 180 days;
- ordinary preferences: 12 months;
- optional analytics event data: 14 months; and
- provider security tokens: the shortest duration supported for the documented security purpose.

### 8. Controls

You may accept or decline optional analytics and may change that choice later. You can also delete or block browser storage through browser settings, but blocking necessary technologies may prevent core features from working.

### 9. Contact

Questions about cookies may be sent to the privacy or legal contact address currently displayed on arcticrss.com.

---

# 5. Replacement Security Page

## Security

**Last updated:** Use the actual publication date.

### 1. Reporting a vulnerability

Arctic welcomes good-faith reports that help protect Arctic RSS and ArcticIRC. Send vulnerability reports to the security contact address displayed on arcticrss.com.

Include:

- the affected URL, host, feature, or endpoint;
- a concise description of the issue and likely impact;
- minimal steps to reproduce;
- relevant browser, client, or tool information;
- whether any personal data or other users were affected; and
- a safe way to contact you.

Do not include unnecessary personal data, live credentials, full message transcripts, or destructive proof-of-concept material.

### 2. In-scope systems

The primary scope includes:

- arcticrss.com;
- native ArcticRSS account, reader, authentication, feed, support, and legal flows;
- ArcticIRC routes served by Arctic;
- the Arctic-managed realtime gateway and APIs; and
- official Arctic subdomains explicitly identified as production or authorized test systems.

Only systems operated by Arctic are in scope. Approved external IRC networks, channel services, feed publishers, Google, Cloudflare, Ko-fi, hosting providers, email providers, and other third parties are outside Arctic's vulnerability-disclosure scope and must be reported to their operators.

### 3. Good-faith research guidelines

To remain within this policy:

- use accounts and data you own or have explicit permission to test;
- use the minimum access and traffic needed to confirm an issue;
- stop immediately if you encounter another person's data, private content, credentials, or an unstable system;
- do not retain, copy, alter, delete, publish, or disclose data that is not yours;
- do not send test messages to unaware users or public IRC channels;
- do not establish persistence, move laterally, or attempt to access production secrets;
- do not degrade availability or reliability;
- report the issue promptly and allow reasonable time for investigation before disclosure; and
- comply with applicable law.

### 4. Prohibited testing

The following are not authorized:

- denial-of-service, load, stress, or resource-exhaustion testing against production;
- social engineering, phishing, credential stuffing, password spraying, or account takeover;
- spam, raids, mass messaging, or public-channel testing;
- automated scanning that creates material traffic or alerts;
- physical attacks or attacks on employees, volunteers, users, or providers;
- accessing, modifying, deleting, or exposing another person's data;
- malware deployment, destructive payloads, or persistent backdoors;
- testing third-party IRC networks through Arctic infrastructure without that network's authorization; or
- demanding payment, threatening disclosure, or withholding information needed to reduce harm.

### 5. Safe-harbor statement

When a researcher makes a good-faith effort to follow this policy, avoids privacy harm and disruption, reports promptly, and does not exploit an issue beyond what is necessary to demonstrate impact, Arctic will not initiate legal action solely for an accidental violation of this policy.

This statement does not authorize violations of law, third-party rights, or third-party terms, and it does not bind independent third parties or law-enforcement agencies.

### 6. What to expect

Arctic aims to acknowledge a complete report within seven business days. Investigation and remediation time depend on severity and complexity. Arctic may ask for additional information and may provide status updates when practical.

Do not publicly disclose an unresolved issue until Arctic has had a reasonable opportunity to investigate and reduce harm.

### 7. No bug bounty

Arctic does not currently operate a paid bug-bounty program and cannot guarantee payment, gifts, public credit, or other rewards.

### 8. Abuse and moderation reports

Harassment, spam, threats, impersonation, harmful messages, and channel-rule disputes are generally moderation matters, not software vulnerabilities. Use the in-product reporting tools for native Arctic rooms. For conduct on an external IRC network, follow the network-specific reporting instructions shown by Arctic and the network or channel's own process.

### 9. Account security

Use a strong unique password or trusted OAuth provider, protect your email account, sign out from shared devices, and report suspected account compromise through the contact address shown on the site.

---

# 6. Community Guidelines

## ArcticIRC Community Guidelines

**Last updated:** Use the actual publication date.

ArcticIRC is intended for useful, human conversation around shared interests. These Guidelines apply to native Arctic rooms. External IRC networks and channels have their own rules, which also apply when you connect to them.

### 1. Treat people as people

Do not harass, threaten, stalk, intimidate, shame, or organize abuse against another person. Disagreement is allowed. Persistent personal attacks are not.

### 2. No hate or targeted abuse

Do not promote hatred, dehumanization, exclusion, or abuse targeting people because of race, ethnicity, nationality, caste, religion, sex, sexual orientation, gender identity, disability, serious medical condition, age, or another protected or vulnerable characteristic.

### 3. Protect privacy

Do not publish another person's private, identifying, intimate, financial, medical, location, credential, or contact information without authorization. Do not threaten to expose it. Do not encourage others to locate or target someone offline.

### 4. No sexual exploitation or child endangerment

Do not sexualize, groom, solicit, exploit, or endanger a minor. Child sexual abuse material and attempts to obtain or distribute it are prohibited and may be reported to appropriate authorities as required by law.

ArcticIRC is 18+ during the beta, but the prohibition applies regardless of where content originated.

### 5. No scams, spam, or manipulation

Do not send unsolicited promotions, repetitive messages, fraudulent offers, phishing, impersonation scams, coordinated inauthentic activity, or deceptive links. Do not artificially inflate activity or discovery rankings.

### 6. No malware or serious wrongdoing

Do not distribute malware, stolen credentials, destructive payloads, or links intended to compromise another person. Do not use ArcticIRC to plan or facilitate violence, exploitation, fraud, or other serious illegal harm.

### 7. Do not impersonate or evade enforcement

Do not impersonate another person, organization, moderator, bot, or staff member. Do not create or use accounts, handles, networks, or technical workarounds to evade a mute, ban, suspension, rate limit, or other enforcement action.

### 8. Respect intellectual property

Share links and brief discussion responsibly. Do not distribute infringing copies or use ArcticIRC to coordinate repeated infringement. Rights holders may report alleged infringement through the legal contact address shown on the site.

### 9. Keep rooms usable

Follow room topics and operator instructions. Avoid flooding, excessive cross-posting, disruptive formatting, repeated off-topic promotion, or behavior that prevents others from participating.

### 10. Public-conversation warning

Native room messages are retained by Arctic for 90 days and may be reviewed by authorized moderators when reported or needed for safety. Other participants may independently copy or retain messages. External IRC participants, bots, channel operators, and networks may also log messages under their own rules.

Do not post information you need to remain secret.

### 11. Reporting and enforcement

Use the in-product report tool for native Arctic content. Reports should be truthful and limited to information needed for review.

Arctic may warn, remove content, apply slow mode, mute, kick, ban, limit features, suspend, or terminate accounts. Serious or repeated violations may lead to immediate action. External-network enforcement remains under the control of that network and its channel operators.

### 12. Appeals

You may request review of an Arctic enforcement decision through the contact address shown on the site. Include the affected account, approximate date, and reason you believe the decision should be reconsidered. Do not submit repeated or abusive appeals.

---

# 7. Retention and Deletion Policy

## Retention and Deletion Policy

**Last updated:** Use the actual publication date.

Arctic keeps personal information only as long as reasonably needed to provide the Service, protect users, maintain security, resolve disputes, and comply with law. This page states the default schedule. A documented legal hold or active safety, abuse, fraud, or security investigation may temporarily extend a period for specifically identified information.

### Retention schedule

| Data category | Default retention | Deletion or expiry behavior |
|---|---:|---|
| Active account and RSS reader data | While the account is active | Deleted from primary systems within 30 days after a verified account-deletion request, subject to listed exceptions |
| Chat profile, handle, settings, favorites, blocks, and notifications | While active or until changed | Deleted within 30 days after account deletion; individual settings are removed when the user changes them |
| Current native-room membership | While the user is a member | Removed when the user leaves; unnecessary historical membership metadata deleted within 30 days |
| Native-room message body | 90 days from creation | Automatically deleted from primary systems at expiry |
| User- or moderator-deleted native message body | No later than 24 hours after deletion | Body removed; a content-free tombstone may remain until the original 90-day expiry |
| Reported-message evidence | While report is open, then 12 months after ordinary closure | Stored separately with restricted access; serious safety or legal cases may be retained up to 24 months |
| Reports and moderator notes | While open, then 12 months after ordinary closure | Serious safety, repeat-abuse, fraud, or legal cases may be retained up to 24 months |
| Moderation actions and administrative audit logs | 24 months | Automatically deleted or irreversibly de-identified at expiry unless under legal hold |
| Active sanctions | Until expiry or removal | Expired ordinary sanction metadata retained 12 months; serious or permanent-sanction records reviewed and retained no more than 24 months after account closure unless legally necessary |
| Typing indicator | Approximately 10 seconds | Expires automatically; no durable history |
| Presence state | Up to 2 minutes after last heartbeat or disconnect grace | Expires automatically; no durable history |
| Ordinary join, leave, socket, and gateway diagnostics | 30 days | Automatically deleted or de-identified |
| Standard application, reverse-proxy, and delivery logs | 30 days | Automatically deleted or de-identified |
| Security events, authentication anomalies, and abuse signals | 90 days | Confirmed incident evidence may be retained for 12 months after incident closure |
| Live rate-limit counters | Up to 24 hours | Expires automatically unless attached to a documented incident |
| Optional analytics event data | 14 months after collection | Collected only after consent; aggregate non-identifying statistics may be kept longer |
| Cookie-consent record | 180 days or until material policy change | Replaced when the user updates the choice |
| Support and ordinary account-correspondence records | 24 months after closure | Deleted or de-identified unless needed for an unresolved dispute or legal obligation |
| Account-deletion completion record | 24 months | Contains only request date, completion date, policy version, and minimal internal reference |
| Rolling backups | No more than 30 days | Expire through backup rotation; restored systems rerun deletion jobs |
| External IRC message bodies | Active browser/connection session only | Not persisted by Arctic on the server or in backups during beta; cleared at disconnect, sign-out, tab close, or browser-session end |
| External IRC credentials | Active connection memory only | Cleared on disconnect; not stored during beta |
| External network profile, favorites, and autojoin choices | Until changed or account deletion | Removed when the user changes them or within 30 days after account deletion |
| External IRC connection and error metadata | 30 days; security events 90 days | Automatically deleted under the log schedules above |
| Minimal anti-abuse record for a sanctioned deleted account | Up to 24 months | No message body; only information reasonably necessary to prevent immediate ban evasion |

### Account-deletion workflow

1. Receive the request through account settings or the site's contact address.
2. Verify that the requester controls the account.
3. Mark the account deletion-pending, prevent new posting, revoke active sessions and chat tokens, and disconnect external IRC sessions.
4. Delete account, reader, profile, membership, favorite, block, notification, and external-network data from primary systems within 30 days.
5. Sever authorship links for native messages still inside the 90-day window and display “Deleted user.”
6. Review any messages specifically identified as containing personal information that may require earlier removal.
7. Preserve only restricted report evidence, legal holds, active sanctions, minimal anti-abuse data, audit records, and deletion proof allowed by this policy.
8. Let backup copies expire within 30 days.
9. Send completion confirmation when the deletion is complete, unless doing so is impossible or legally restricted.

### Deleted and archived rooms

When a native room is archived, it becomes unavailable for new ordinary posting. Existing messages continue to follow their original 90-day expiry unless an earlier deletion is required.

When a room is permanently deleted, ordinary room metadata and non-evidentiary content are removed from primary systems within 30 days. Restricted report evidence and audit records remain only for their stated periods.

### External copies

Arctic cannot delete information independently retained by external IRC networks, channel operators, bots, other participants, feed publishers, linked sites, analytics providers acting under their own retention rules, or recipients of valid legal disclosures. Arctic will delete or request deletion from its processors where required and technically available, but cannot promise deletion from systems it does not control.

### Legal holds

A legal hold must identify the data, reason, authorized decision-maker, start date, and review date. Access must be restricted. The hold must be reviewed at least every 90 days and released when the reason ends. Normal deletion then resumes.

### Contact

Questions or deletion requests may be sent to the privacy or legal contact address currently displayed on arcticrss.com.

---

# 8. User-facing notices

## 8.1 First ArcticIRC activation

Use a concise modal or page with unchecked controls:

> **Welcome to ArcticIRC**
>
> ArcticIRC is an 18+ beta. Native room messages are visible to other eligible room participants and are normally kept for 90 days. Other participants may copy what you post. External IRC networks have separate rules and may independently log messages or receive connection information.
>
> [ ] I confirm that I am at least 18 years old.
>
> [ ] I agree to the Terms of Service and Community Guidelines.
>
> Links: Privacy Policy · Retention and Deletion Policy · Cookie Settings

Do not combine optional analytics consent with this activation. Analytics requires a separate choice.

Record the accepted Terms version, Guidelines version, age-attestation version, timestamp, and account ID.

## 8.2 External-network first connection

Show before the first connection to each network:

> **You are connecting to [NETWORK NAME]**
>
> [NETWORK NAME] is an independent IRC network with its own rules, operators, and privacy practices. The network will receive your IRC identity and messages. Depending on the approved connection method, it may also receive your IP address or an Arctic gateway address. Channel participants, bots, and operators may independently log messages. ArcticIRC is limited to Arctic users age 18 or older, but Arctic cannot guarantee the age of people on the external network.
>
> Arctic cannot remove copies held outside Arctic or override a network or channel ban.
>
> Network rules · Network privacy notice · Connection details
>
> [Cancel] [Connect]

The connection-details link must accurately state the deployed mode. Do not claim that an IP address is hidden or disclosed unless verified for that network and endpoint.

## 8.3 Chat composer reminder

On first use, or through an accessible info control near the composer:

> Messages in native rooms are kept for 90 days and may be copied by participants. Do not post secrets or personal information you cannot safely share.

## 8.4 Report form notice

> Reports are reviewed by authorized moderators. A restricted copy of the reported content and nearby context may be retained for 12 months after the case closes, or up to 24 months for serious safety, repeat-abuse, fraud, or legal matters.

## 8.5 Cookie choice

Use two equally prominent choices:

- **Necessary only**
- **Accept optional analytics**

Supporting text:

> Necessary technologies keep accounts, security, the reader, and chat working. Optional analytics help us understand product use. Analytics never receives chat messages, reports, IRC credentials, or raw feed-subscription lists. You can change this choice later.

---

# 9. Codex implementation instruction

Paste this section into Codex and attach this full package as the owner-approved source.

```text
Owner approval for ArcticIRC Phase 11 launch blockers:

Use docs/arcticirc/arcticirc-launch-policy-package.md as the policy and
retention source of truth. The owner approves the decisions and wording in
that document, subject to the requirements below.

Do not invent a company name, mailing address, cookie name, provider, data
flow, security control, or contact email. Reuse the legal/security contact
already configured in the site. If a publication field is not available,
stop only that publication field and report it; complete the rest of the
implementation. Never publish bracketed placeholders.

The publication date must be the actual deployment date, not the draft date.

Required product decisions:

1. Arctic RSS remains 13+. ArcticIRC is 18+ during beta.
2. Require a one-time ArcticIRC age attestation and Terms/Guidelines
   acceptance. Do not collect a full birth date.
3. Native room metadata may be visible to guests, but native transcripts are
   signed-in only and must not be search-engine indexed.
4. Native messages expire after 90 days.
5. Deleted message bodies leave primary systems within 24 hours. A
   content-free tombstone may remain until the original expiry.
6. Ordinary closed reports/evidence are retained for 365 days after closure.
   Serious safety/legal evidence may be retained for 730 days.
7. Moderator/admin audit logs are retained for 730 days.
8. Standard logs are retained for 30 days; security logs for 90 days.
9. Presence TTL is no more than 120 seconds; typing TTL approximately 10
   seconds.
10. Rolling backups are retained for no more than 30 days.
11. External IRC message bodies and credentials are session-only and must not
    enter server persistence, backups, analytics, or ordinary logs.
12. Optional analytics may load only after affirmative consent; retain event
    data 14 months. Necessary-only must be equally prominent and must not
    reduce service access. Disable advertising features, Google Signals, ad
    personalization, user-ID transmission, and unnecessary provider data
    sharing where the analytics provider offers those controls.
13. Analytics, logs, metrics, and error reporting must never contain chat
    message bodies, report content, chat handles, external IRC credentials,
    private room names, or raw feed-subscription lists.
14. Account deletion completes in primary systems within 30 days. Revoke
    sessions and disconnect IRC promptly. Sever authorship of unexpired
    native messages and display “Deleted user.”
15. Personalized discovery may use followed-feed topics, selected topics,
    joined/favorited rooms, language, and aggregate room signals. It may not
    expose raw subscriptions or use private-message/report text. Add a setting
    to disable personalization.

Publication work:

- Replace or update /terms, /privacy, /cookies, and /security with the exact
  approved substance from the package, adapting only names and implementation
  facts that are verified in the repository.
- Add /community and /retention pages.
- Add both pages to the legal hub and all relevant footers/settings surfaces.
- Keep the existing visual language and accessibility conventions.
- Add noindex to native transcript routes and ensure guests cannot fetch
  transcript data through APIs or socket events.
- Add the first-activation and external-network notices specified in the
  package.
- Add a separate, reversible analytics-consent control. Do not treat Terms,
  privacy acknowledgment, age attestation, or account creation as analytics
  consent.
- Inventory actual cookies and browser-storage keys from code and production
  configuration. Publish their real names, providers, purposes, storage
  types, maximum durations, and consent categories. Do not guess.

Retention/deletion implementation:

- Put retention values in centralized typed configuration with safe defaults.
- Implement idempotent scheduled deletion jobs for messages, tombstones,
  reports/evidence, audit records, historical memberships, and any other
  database-backed category in the policy.
- Ensure report evidence is stored separately from the ordinary ChatMessage
  lifecycle and is access-restricted.
- Implement account deletion as a resumable/idempotent workflow that revokes
  sessions, prevents posting, disconnects sockets and upstream IRC sessions,
  removes account-linked data, severs message authorship, and records minimal
  completion proof.
- A disaster-recovery restore must rerun retention/deletion jobs before the
  service is reopened.
- Document infrastructure log and backup retention where code cannot enforce
  it directly.
- Do not add persistent external IRC buffers or credential storage.

Minimum tests:

- message hard-expiry at 90 days;
- deleted body removed while content-free tombstone remains only as allowed;
- report evidence survives ordinary message expiry and then expires on its
  own schedule;
- ordinary and serious report retention boundaries;
- audit-log expiry;
- presence and typing TTL;
- deletion-pending accounts cannot post or reconnect;
- account deletion severs message authorship and removes memberships,
  favorites, blocks, settings, external profiles, and active sessions;
- external IRC message bodies and credentials never reach persistence,
  backups, analytics, structured logs, or error telemetry;
- analytics script and events do not load before consent;
- necessary-only choice leaves all product features available;
- changing consent takes effect without requiring account deletion;
- guest and crawler access cannot retrieve native transcripts;
- policy links and acceptance-version records work with keyboard and screen
  readers.

Before marking complete:

- Compare every published claim against actual code and production
  configuration.
- If behavior and wording differ, change the behavior or explicitly report
  the mismatch; do not publish an inaccurate claim.
- Run lint, typecheck, unit/integration tests, migration checks, and production
  build.
- Report changed files, schema changes, jobs, configuration values, tests,
  cookie inventory, remaining infrastructure actions, and any factual field
  still requiring the owner.
- Do not deploy, run production migrations, change DNS, configure email
  aliases, or alter production analytics without explicit owner authorization.
```

---

# 10. Launch verification checklist

Codex or the owner should verify every item before public beta:

- [ ] Actual operator/contact information is present; no placeholders remain.
- [ ] Terms, Privacy, Cookies, Security, Community, and Retention pages share the same effective date.
- [ ] Existing users see the material-update notice before first ArcticIRC use.
- [ ] ArcticIRC requires 18+ attestation without collecting date of birth.
- [ ] Analytics does not load before consent.
- [ ] “Necessary only” is as easy to choose as analytics acceptance.
- [ ] Cookie inventory matches production names and durations.
- [ ] Guest users and crawlers cannot retrieve native transcripts.
- [ ] Message expiry is enforced, not merely documented.
- [ ] Report evidence is separate and access-restricted.
- [ ] Account deletion disconnects native and external sessions.
- [ ] External IRC messages and credentials are absent from database, backups, analytics, logs, and telemetry.
- [ ] External-network notices accurately describe IP and connection behavior.
- [ ] Backup retention is actually 30 days or shorter.
- [ ] Infrastructure logs are actually 30/90 days as stated.
- [ ] Moderation, privacy, security, and legal contacts are monitored.
- [ ] A moderator can process deletion, appeal, safety, and external-network reports.
- [ ] Production rollback and emergency IRC kill-switch procedures are documented.
