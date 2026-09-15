---
title: About
subtitle: Software engineering by training. Application and mobile security by obsession.
description: Background, focus and the tools this archive is written from — Android internals, AppSec, reverse engineering and malware analysis.
eyebrow: PROFILE
---

I am a senior software engineer moving the centre of gravity of my work into
application security — Android and iOS internals, reverse engineering, malware
analysis, and the boring, high-leverage parts of AppSec that actually change
whether a control holds.

This archive is the public half of that work. Nothing here is a tutorial
recycled from a certification course. Entries are write-ups of assessments,
lab reconstructions and tooling built because the existing options were
wrong for the job.

## Focus

- **Mobile security.** Storage, transport, IPC, and the gap between what the
  platform documents and what a given build actually does.
- **Reverse engineering.** Dalvik, native libraries, and the JNI boundary
  between them. Static first; dynamic when the binary is no longer the
  program that runs.
- **Malware analysis.** Obfuscated droppers, loaders, and the infrastructure
  they call. Static unwrapping preferred; detonation last.
- **Application security.** HTTP framing, authentication, and the class of
  bugs that live in the disagreement between two components.

## How this is written

Findings are written as findings: identifier, severity, CWE, status, and the
reasoning. Terminal output is real. HTTP messages are real. File trees are
the ones that were on disk. Where a technique could be turned into a
one-click exploit, the write-up stops at the method, the detection, and the
fix — the rest belongs in a lab, not in a public archive.

The CMS that publishes this site is part of the same project. The public
site is the publication; the CMS is the instrument. Neither is a template.

## Tools that show up often

Ghidra, jadx, Frida, the Android Keystore APIs, OkHttp, Burp, a small set of
Python harnesses of my own, and whatever the current sample demands.

If you want to talk about an assessment, a collaboration, or a role that is
actually about this work: the addresses are in the rail.
