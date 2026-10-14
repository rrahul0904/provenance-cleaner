# Offline capability boundary

## Available design

Deterministic inspection that runs in the browser can remain available without connectivity: supported Unicode checks, supported file metadata inspection, local C2PA verification, hashing and receipt generation. The offline shell has automated tests.

## Online-only operations

Authentication, account history, credit balance, API keys, billing, server-authoritative sanitation, paid transforms, model generation, webhook reconciliation and admin operations require online trusted services. The UI must report unavailable state and must not queue or replay a paid action without rechecking server state and idempotency.

## Cache policy

Do not cache sensitive account/payment/generated/raw-content responses in a service worker. Offline receipts must identify the artifact and local operation clearly; they do not prove server billing or provider processing. Reconnection does not itself grant entitlements or credits.

## Verification gap

Repository tests cover offline shell behavior. A browser disconnect/reconnect journey across primary controls has not been certified on production or a target Chrome build.
