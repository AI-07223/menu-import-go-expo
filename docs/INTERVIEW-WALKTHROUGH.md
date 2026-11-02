# Explain this sample honestly

This is an AI-assisted reimplementation, not evidence of years of production experience in Go or Expo.

1. Start with the user flow: a photographed menu becomes an editable draft, and only reviewed data is saved.
2. Trace `price` from model JSON through `ParseMinor`, `priceMinor` in GraphQL, editable rupee text in React, and integer `price_minor` in PostgreSQL.
3. Explain `*bool` in Go: nil is unknown, false is non-vegetarian, true is vegetarian. Show why ordinary string-to-bool coercion would lose meaning.
4. Show that `scanMenu` does not call the repository. `saveMenu` validates again, even though the UI also checks fields.
5. Read the rollback test: the second duplicate dish causes a real database constraint failure after earlier inserts. The transaction must remove all changes from that save.
6. Explain how request contexts stop retries and provider calls, and how a deadline can leave a client uncertain whether a save committed. The sample tells the owner to reload saved menus; it does not claim exactly-once retries.
7. Name two next steps: real-menu evaluation and proper user/tenant authorization. Native-device tests and cloud deployment would be additional evidence, not claims to make now.

Suggested application description:

> An AI-assisted menu-import sample rebuilt in Go, GraphQL, PostgreSQL and TypeScript/React with Expo. It separates uncertain model output from reviewed, transactionally saved data, uses integer currency units, and includes tests against a real database. The web client is verified; native execution and GCP deployment are not claimed.
