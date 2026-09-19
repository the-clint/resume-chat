# Attach clint.broadhead.dev to the deployed app

Type: task
Status: open
Blocked by: 11

## Question

Work, not a decision: point `clint.broadhead.dev` at the deployed app and verify HTTPS serves the token screen.

Pre-existing state: the hostname already resolves to Cloudflare edge IPs and returns HTTP 530, so the proxied record exists but has no reachable origin — this ticket replaces or retargets it rather than creating DNS from nothing.

Records on resolution: the record type and target, whether it ended up a Worker custom domain or a route, and the verified live URL.
