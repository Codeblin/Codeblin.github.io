---
record: 3
name: framewalk
tagline: Differential HTTP framing — two parsers, one catalogue, a diff
status: research
startedAt: 2025-01
technologies:
  - python
  - http
  - ast
repository: https://github.com/codeblin/framewalk
featured: false
published: true
---

Request smuggling is a disagreement about message length. Proving the
disagreement does not require sending a crafted request at a live service.
It requires running the same bytes through two parsers and comparing how
each one framed the body.

`framewalk` drives a catalogue of specification-edge messages — duplicated
framing headers, unusual whitespace, obsolete line folding — through a pair
of implementations and reports where they diverge. The method is the lab
half of
[When Two HTTP Parsers Disagree](/research/request-smuggling-in-a-legacy-proxy/).

## Catalogue, not payloads

The corpus is classified by RFC 9112 clause, not by exploit name. A row in
the report is "parser A treated this as 24 bytes, parser B as 20." What an
attacker would put in the leftover four bytes is out of scope for the tool
and out of scope for the write-up.

```diagram caption="Lab topology — nothing here is a live service"
catalogue ──▶ driver ──▶ parser A ──▶ length A
                 │
                 └──▶ parser B ──▶ length B
                                   │
                                   └──▶ diff
```

## Status

Research. The driver and the report format are stable. Adding a new parser
is a small adapter; the adapters for the reverse proxy and application
server from the original assessment are not in this repository — they were
built against private builds.
