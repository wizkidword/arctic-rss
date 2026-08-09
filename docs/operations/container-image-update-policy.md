# Container image update policy

## What is pinned

Production source uses a readable version tag plus an immutable
multi-architecture manifest digest for every third-party runtime image:

- Node and nginx in `Dockerfile`;
- PostgreSQL, durable Redis, ephemeral Redis, and Cloudflared in
  `docker-compose.yml`; and
- PostgreSQL used by `scripts/production-restore-drill.sh`.

The tag describes the intended release family; the digest is the exact image
that Docker is allowed to fetch. The manifest digest keeps supported production
architectures selectable without accepting a mutable tag.

## How updates are reviewed

Dependabot checks the root Docker and Compose manifests weekly and opens a pull
request for available image updates. Image updates are proposals only: they do
not auto-merge, change OVH, or deploy Arctic RSS.

Every pull request, including an image-update proposal, must pass the existing
CI gates. They rebuild the production images, record their byte sizes, run
Trivy, upload an SBOM for each production image, and exercise the
Compose-backed release gates.

When accepting a Docker update, review the changed tag and digest together.
Align the restore-drill and disposable-test image references with the accepted
PostgreSQL or Redis release before merging. Then use the normal approved
release process; a green CI run is not deployment authorization.
