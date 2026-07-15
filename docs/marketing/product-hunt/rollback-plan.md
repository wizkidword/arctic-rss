# Launch rollback plan

## Product release rollback

1. Stop promotion and record the customer-facing symptom with UTC time, route, device, and release SHA.
2. Use the existing approved deployment rollback runbook: `docs/operations/deployment-rollback-runbook.md`.
3. Roll back only through an authorized operator; do not improvise production commands or expose secrets.
4. Verify `/`, `/guest`, a guest article, and canonical origin in a logged-out browser after rollback.
5. Keep the Product Hunt draft/public page truthful. If the launch is live and a major issue exists, update owned communication candidly; do not hide a material outage behind marketing.

## Asset rollback

1. If an image/video is inaccurate, private, or broken, remove it from the manual Product Hunt draft before publishing.
2. Replace it only after `npm run ph:assets:validate` passes and a reviewer approves it.
3. Keep raw recordings local/ignored; do not commit personal or production captures.

## Decision authority

- Product release: existing authorized release operator and named human approver.
- Product Hunt page, maker comment, and community replies: the maker personally.
- Public/marketing data use: the designated privacy/owner approver in `human-inputs.md`.
