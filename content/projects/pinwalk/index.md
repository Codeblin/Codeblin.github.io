---
record: 4
name: pinwalk
tagline: Enumerate every HTTP client in an APK and say which of them actually pin
status: research
startedAt: 2026-04
technologies:
  - python
  - android
  - jadx
  - tls
repository: https://github.com/codeblin/pinwalk
featured: false
published: true
---

Certificate pinning configured on the primary `OkHttpClient` covers the
traffic that goes through it. The image loader, the WebView, the crash
reporter and the payments SDK are separate clients, and they are where
pinning most often is not.

`pinwalk` decompiles an APK, walks the HTTP client constructors it knows
about, and reports which of them have a pin set attached — plus the pin set
expiration date, if the network-security config is in use. The review
checklist is the one in
[Certificate Pinning That Actually Holds](/research/certificate-pinning-that-holds/).

## What it reports

| Signal | Source |
| :--- | :--- |
| OkHttp `CertificatePinner` builders | decompiled Kotlin/Java |
| `network_security_config.xml` pin sets | resources |
| WebView TLS paths | class presence, not a verdict |
| Known vendor SDK client classes | a small allowlist |

WebView is flagged as a separate stack, not scored. Scoring it would be a
guess.

:::note{title="Status is experimental for a reason"}
The constructor heuristics drift with OkHttp versions and with obfuscation.
A clean report is evidence; a quiet report is not a pass. Always confirm
with an intercepting proxy and a device-trusted CA — the scenario the
control exists for.
:::

## Status

Experimental. Useful as a first pass on a large APK; not a substitute for
step six of the checklist.
