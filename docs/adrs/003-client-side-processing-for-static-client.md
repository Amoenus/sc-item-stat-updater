# ADR 003: Client-Side Processing for a Future Static Client

## Status
Accepted, future-facing

## Context
If the project later adds a static web client, it will need a mechanism for merging intermediary JSON artifacts (from ADR 002) with the user's local `global.ini` file. A traditional approach might involve uploading `global.ini` to a backend server, processing it, and returning the updated file.

## Decision
A future static web app will **not** use a backend server to process the `global.ini` file. Instead, it will use browser file APIs and process the text entirely within the user's browser via client-side JavaScript.

## Consequences
### Positive
* **Security & Privacy:** Users are often hesitant to upload sensitive or personal configuration files to third-party servers. Processing locally guarantees their files never leave their machine.
* **Cost Efficiency:** This architecture eliminates the need for any backend compute infrastructure. The web interface can be hosted entirely on a free static host like GitHub Pages.
* **Speed:** Network latency for uploading and downloading files is eliminated. String manipulation in JavaScript is fast enough for instantaneous processing of standard `.ini` files.
* **Zero Backend:** Reduces maintenance burden by not having to secure, scale, or monitor a traditional server backend.

### Negative
* **Browser Compatibility:** Relies on modern browser features (like the File API). However, support for these APIs is nearly universal in modern browsers.
* **Complex Client Logic:** Moves slightly more complex string replacement and merging logic into the frontend codebase.
