---
record: 3
title: Four Layers of Nothing
subtitle: Unwrapping an obfuscated VBScript dropper, and why the obfuscation told us more than the payload did
excerpt: >-
  A 900 KB script attachment that decoded to eleven lines of actual logic. The
  interesting part was never the payload — it was what four layers of
  indirection reveal about who built it and what they expected to defeat.
status: published
publishedAt: 2025-05-21
updatedAt: 2025-06-02
category: malware-analysis
tags:
  - vbscript
  - obfuscation
  - static-analysis
featured: true
---

The sample arrived the way these always do: an attachment on a mail flagged by
a user rather than by a filter, forwarded with the subject line intact and a
one-sentence note asking whether it was anything. It was 912 KB of VBScript.
The final payload logic, once every wrapper was removed, was eleven lines.

That ratio is the story. Nobody writes 912 KB of obfuscation to hide eleven
lines because the eleven lines are clever. They write it because the eleven
lines are ordinary and the only remaining advantage is not being read — by a
scanner, or by an analyst who gives up.

This is a write-up of the unwrapping method, the indicators it produced, and
the detection logic we shipped afterwards. I have deliberately not reproduced
functional malicious code; every snippet below is either inert, abridged, or a
paraphrase sufficient to explain the technique.

## Handling the sample at all

Before anything else: this was done on an isolated analysis VM with no network
route, a snapshot taken beforehand, and the file's extension neutralised on
disk so no double-click could ever execute it. Static-first is not caution
theatre — a dropper's entire purpose is to run, and the analysis is cheaper
when it never gets to.

```terminal host="analysis-vm" exit="0"
$ file invoice_scan.vbs.sample
invoice_scan.vbs.sample: ASCII text, with CRLF line terminators, with very long lines
$ wc -c invoice_scan.vbs.sample
934128 invoice_scan.vbs.sample
$ wc -l invoice_scan.vbs.sample
     47 invoice_scan.vbs.sample
```

Forty-seven lines holding 912 KB. One line was 780 KB on its own. That shape —
few lines, enormous width — is itself a signal, and it is one you can detect
without understanding a single byte of the content.

## Layer one: a string, reversed and split

The outer wrapper was the laziest layer, which is typical. A very large string
literal, assembled by concatenating thousands of fragments, then reversed and
handed to `Execute`.

```vbscript title="Layer 1, paraphrased and inert"
' Structure only — the real sample concatenated ~9,000 fragments.
s = "..." & "..." & "..."          ' 780 KB of fragments
For i = Len(s) To 1 Step -1
    t = t & Mid(s, i, 1)          ' reverse
Next
' Execute t                       ' <- neutralised for analysis
```

The unwrapping rule for every layer of this kind is the same, and it is worth
stating once because it applies far beyond VBScript: **find the sink, replace
it with output.** You never need to run the malicious behaviour to see the next
layer; you need the interpreter to hand you the string it was about to run.

Replacing `Execute t` with a write-to-file gave layer two. Total time: about
four minutes.

:::note{title="Sinks worth knowing in Windows Script Host"}
`Execute`, `ExecuteGlobal` and `Eval` are the script-level sinks.
`WScript.Shell.Run`, `WScript.Shell.Exec` and anything reaching
`Win32_Process.Create` through WMI are the process-level ones. Layered droppers
almost always pass through the first group several times before touching the
second, and each pass is a free opportunity to intercept.
:::

## Layer two: character arithmetic

Layer two was 340 KB and looked entirely different — an array of integers and a
loop applying arithmetic to each before rebuilding a string with `Chr`.

```vbscript title="Layer 2, paraphrased and inert"
a = Array(114, 108, 121, 108, 55, 121)   ' abridged; ~90,000 entries
k = 23
For i = 0 To UBound(a)
    o = o & Chr((a(i) - k) Mod 256)
Next
' ExecuteGlobal o                        ' <- neutralised
```

A fixed subtraction is not encryption, and it is not really obfuscation
either — it is a substitution cipher with a single-byte key, and the key was a
literal three lines above the loop. Same treatment: replace the sink, dump the
output.

What made this layer informative was not the cipher but a mistake in it. The
`Mod 256` was applied *after* the subtraction, so any original byte below 23
wrapped around. The author never noticed because no byte in their payload was
that low. That is the signature of code assembled by a generator and tested
exactly once, on exactly one input.

## Layers three and four: environmental checks

Layer three was where it stopped being mechanical. Only 8 KB, and most of it
was not decoding logic at all — it was a series of checks on the environment,
each of which caused a silent, clean exit if it failed.

| Check | Method | Defeats |
| :--- | :--- | :--- |
| Username | Compared against a list of common sandbox account names | Automated sandboxes |
| Disk size | WMI query on total physical disk capacity | Small-disk analysis VMs |
| Uptime | Exit if the host had been up under ten minutes | Fresh-boot sandbox runs |
| Process list | Looked for common analysis tool process names | Live analyst observation |
| Screen resolution | Exit on very small or unusual dimensions | Headless automation |

None of these are sophisticated, and every one of them is defeated by an
analysis environment that looks lived-in. But collectively they explain the
912 KB: the author was not trying to beat a reverse engineer. They were trying
to beat an automated pipeline that gets sixty seconds and no human attention.

:::warning{title="Sandbox evasion inverts your triage assumptions"}
A sample that exits cleanly in your sandbox has not been shown to be benign. It
has been shown to be *unwilling to run in your sandbox*, which is a meaningfully
different and considerably more suspicious result. Treat clean-exit-with-checks
as an escalation trigger, not an all-clear.
:::

Layer four decrypted the final stage with a key derived from the machine's own
volume serial number — meaning a static analyst working from the file alone
cannot decrypt it, and a copy of the sample from a different machine decrypts
to garbage. That is genuinely well-chosen, and it is the only decision in the
whole sample I would call competent.

## What the eleven lines did

With a plausible environment and the correct derived key, the final stage
resolved to what everything else had been protecting: fetch a second-stage
binary over HTTPS from one of three hard-coded hosts, write it to the user's
temporary directory, register a scheduled task to run it, and exit.

::::finding{id="MAL-DROPPER-2025-041" severity="high" cwe="CWE-506" status="open" title="Multi-stage VBScript dropper with environment-derived key"}
A mail-delivered VBScript attachment employing four layers of obfuscation,
five sandbox-evasion checks, and a final stage encrypted with a key derived
from the host volume serial. Terminal behaviour is retrieval and scheduled
execution of a second-stage executable.

The obfuscation is generated rather than hand-written; the evasion checks are
commodity; the key derivation is the only non-trivial element. Assessment:
a commodity loader, purchased or adapted, not bespoke.

:::note{title="Durable indicators"}
The three hard-coded hosts and the scheduled task name are the throwaway
indicators — they rotate per campaign. The durable ones are the *shape* of the
file (very few lines, extreme line length), the wrapped-`Mod` arithmetic bug,
and the specific ordering of the five environment checks, which is stable
across the generator's output.
:::
::::

## Detection that survives the next campaign

We shipped three rules, deliberately at different altitudes, because the
narrow ones expire.

1. **Structural, on the mail gateway.** Any script attachment where the
   longest line exceeds a threshold, or where the byte-to-line ratio is
   extreme. This is content-blind and caught every subsequent variant we saw.
2. **Behavioural, on the endpoint.** A Windows Script Host process creating a
   scheduled task, or writing an executable into a temporary directory. This
   is the terminal behaviour, and the terminal behaviour is what the attacker
   cannot obfuscate away — it is the entire point of the file.
3. **Indicator-based, everywhere.** The three hosts and the task name, with no
   expectation that they last beyond the week.

Only the second rule has a real chance of catching a rewritten loader. Eleven
lines of behaviour is a very small target for static detection and a very
large one for behavioural detection, which is the whole argument for weighting
your defences that way.

---

The layer-stripping was done with the sink-replacement harness in
[unwrap](/projects/unwrap/), which runs a script under a Windows Script Host
shim with the execution sinks redirected to disk, so each layer emits its
successor instead of running it.
