# Repository Architecture

## Principles

1. One project record follows the content from initiation through analytics.
2. Every module receives formal upstream inputs and emits versioned downstream outputs.
3. No downstream module re-enters data already owned upstream.
4. Human approval gates are explicit and cannot be bypassed when configured as mandatory.
5. Agent/provider integrations are adapters, not hard-coded business logic.
6. UI, API and database contracts share central domain types.
7. Auditability, permissions, cost attribution and generation provenance are first-class requirements.
