# Ingestion resource limits

Feed discovery and source refreshes accept only bounded untrusted input. The
reviewed defaults are a 2 MB feed response (8 MB for podcast feeds), 1,000
items per source, a 256 KiB limit for each stored content field, 4 MiB total
normalized body content per refresh, six discovery attempts, and a shared
30-second discovery deadline.

XML entity processing is disabled for feeds, podcasts, discovery, and OPML.
Supported legacy text encodings are UTF-8, UTF-16, Windows-1252, and
ISO-8859-1. Other declarations fall back to UTF-8 rather than selecting an
arbitrary decoder.

Optional `INGESTION_*` environment overrides may lower or raise limits only
within checked application bounds. The service-role manifest is the permitted
variable record. Source metrics record counts and byte totals only, never URLs,
titles, or content.
