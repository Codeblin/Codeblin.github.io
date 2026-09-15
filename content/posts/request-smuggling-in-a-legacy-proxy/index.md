---
record: 2
title: When Two HTTP Parsers Disagree
subtitle: A framing mismatch between a legacy reverse proxy and a modern application server, and how we found and fixed it
excerpt: >-
  Request smuggling is not an exotic bug class. It is two programs disagreeing
  about where a message ends. This is how we located that disagreement in a
  fifteen-year-old proxy safely, and what the fix actually had to change.
status: published
publishedAt: 2025-02-03
category: appsec
tags:
  - http
  - authn
  - dynamic-analysis
featured: false
---

Request smuggling has a reputation for being exotic. It is not. It is a
disagreement about message framing between two programs that both believe they
are parsing HTTP correctly. The weaponised payloads that circulate online are
only the last step; the real work — and the part worth writing down — is
establishing *where* two parsers diverge and *how to close the gap*.

This came out of a routine assessment of an internal application behind a
reverse proxy that predated most of the team maintaining it. The application
server was current. The proxy was not. Everything in between worked perfectly
for well-formed traffic, which is exactly why nobody had looked at it. What
follows is the detection method and the remediation, at the level of detail a
defender needs.

## Framing, and the two ways to declare it

HTTP/1.1 lets a message declare its body length in two ways: a
`Content-Length` header, or `Transfer-Encoding: chunked`. On a keep-alive
connection this length is the only thing that tells a parser where one request
stops and the next begins.

```http-request
POST /api/v1/session HTTP/1.1
Host: internal.example.com
Content-Type: application/json
Content-Length: 24

{"action":"refresh"}
```

The parser reads the headers, takes 24 bytes, and treats byte 25 as the start
of the next request. Both of our two implementations did this identically, and
identically correctly.

RFC 9112 is explicit about what happens when both headers appear:
`Transfer-Encoding` takes precedence, and a message carrying both should be
treated as suspect. That rule exists precisely because the ambiguity is
dangerous. The question for any proxy chain is not whether the rule is
documented but whether both ends implement the same reading of it.

:::note{title="Why the front end and back end must agree"}
A reverse proxy multiplexes many users onto a small pool of upstream
connections. If the front end and the upstream disagree about where a request
ends, bytes are left in the shared connection buffer and become the start of
whatever request arrives next — belonging to whoever happens to be next in the
queue. That cross-user boundary is the entire risk.
:::

## Finding the divergence safely

We did not probe production. The whole point of a controlled assessment is to
establish the *existence* of a parsing disagreement without ever using it
against real user connections. Two techniques did that here.

The first was differential analysis in an isolated lab. We stood up the same
proxy version and the same application server build behind it, then replayed a
catalogue of specification-edge messages — duplicated framing headers, unusual
whitespace, obsolete line folding — recording how each side interpreted the
message length. We were comparing two parsers, not attacking a service.

::::finding{id="APP-HTTP-014" severity="high" cwe="CWE-444" status="fixed" title="Front end and upstream disagree on ambiguous framing"}
The legacy proxy and the modern application server resolved one class of
malformed, ambiguously-framed request to two different body lengths. On a
shared keep-alive connection this is sufficient for one connection's leftover
bytes to be attributed to another — the root condition for HTTP request
smuggling (CWE-444).

:::warning{title="Confirmed in an isolated replica only"}
Every observation was made against a lab copy with synthetic traffic. No
malformed request was ever sent to the production service, because the finding
is the parser disagreement itself — demonstrating it against live user
connections is neither necessary nor responsible.
:::
::::

The second technique was timing, again in the lab. When a front end forwards a
request the upstream considers incomplete, the upstream waits for bytes that
never come and the response is delayed until a timeout fires. A response that
should return in milliseconds taking exactly the socket timeout is a strong,
low-risk signal that the two ends measured the body differently — and it never
requires poisoning a real connection to observe.

## What the fix had to change

The tempting fix is to write a rule that rejects the one malformed request we
found. That is the wrong altitude. The vulnerability was never a single input;
it was that two components were allowed to disagree at all.

1. **Normalise at the edge.** The front end now rejects any request carrying
   both `Content-Length` and `Transfer-Encoding`, and any request with
   duplicated or malformed framing headers, with a `400` — before it is ever
   forwarded. Ambiguous messages do not get a second opinion.
2. **Prefer connection reuse you control.** Where the proxy could be
   configured to open a fresh upstream connection per client request rather
   than pooling across users, we did so on the sensitive paths. It costs
   performance and buys the removal of the cross-user boundary entirely.
3. **Upgrade the framing.** The durable fix was moving the hop to HTTP/2
   between proxy and upstream, where message length is carried by the framing
   layer rather than inferred from ambiguous headers.

| Control | Stops the disagreement | Cost |
| :--- | :--- | ---: |
| Reject ambiguous framing at edge | Yes, for known cases | Low |
| Per-client upstream connections | Yes, removes shared buffer | Medium |
| HTTP/2 to the upstream | Yes, structurally | Higher |

## The general lesson

Every request-smuggling finding I have worked on reduces to the same sentence:
two programs on one connection disagreed about where a message ended. You do
not need to weaponise that disagreement to prove it exists, and you should not
— a lab replica, differential replay and timing are enough to establish the
finding and validate the fix.

Treat framing ambiguity as a class, not an instance. The moment your edge
guarantees that every message reaching the upstream has exactly one
unambiguous length, the entire family of bugs has nowhere to live.

---

For the differential replay harness used in the lab, see
[framewalk](/projects/framewalk/), which drives a catalogue of edge-case
messages through a pair of parsers and diffs how each one framed the body.
