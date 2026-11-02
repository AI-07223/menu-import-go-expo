# Decisions worth discussing

The new stack serves the same product need as the Laravel workflow. It is intentionally a small vertical slice rather than a rewrite of the complete billing application.

## Ownership of data

AI returns untrusted JSON. Go validates the response structure and turns uncertain prices and dietary flags into null. The client retains that uncertainty, shows editable fields, and requires review. The save resolver validates again because clients can bypass UI checks.

A model may still return a confident but wrong value. Null handling does not detect every hallucination; the owner must compare the draft with the source image. The prompt is not a security boundary. The provider cannot execute tools or write to the database.

## Money

`priceMinor` is an integer number of paise. Parsing accepts plain decimals with at most two fractional digits and never removes a minus sign or currency symbol. `10.10` becomes `1010`, without binary floating-point rounding. The sample supports only INR; adding currencies requires explicit currency metadata and different minor-unit rules, not just changing a label.

## Failures and atomicity

Transport failures, 429 and 5xx may retry once per configured provider; malformed output moves directly to the next provider. The server request has a 45-second context and individual HTTP calls have 12-second timeouts. The context bounds the combined chain.

The save transaction inserts a menu and all dishes. A real integration test makes the second dish violate a uniqueness constraint, then checks neither the parent nor first child escaped rollback. This proves the tested atomicity condition, not exactly-once behavior across repeated requests.

## Small contract

GraphQL distinguishes `demoDraft`, `scanMenu`, `saveMenu` and `menus`. The client does not send SQL. Query depth, document length, body size, image dimensions and row counts are bounded. The custom operator header avoids putting secrets in URLs and is separate from Cloud Run IAM authorization. Authentication is deliberately single-operator and must be replaced for a shared product.

Variants are validated value objects stored as JSONB within each dish. That keeps this small sample focused; separate relational rows would be more useful for independently edited or frequently queried variants.

## What was not ported

Logo import, billing, payments, staff management and customer ordering are outside this sample. They add breadth without helping a reviewer follow the extraction-to-save flow. The original Laravel source remains separate.

## AI assistance

AI generated substantial implementation and review material. The useful interview exercise is to trace a field through the system, explain a failed test, and change behavior with verification—not claim unaided authorship.
