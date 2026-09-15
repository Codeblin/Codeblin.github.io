---
record: 2
name: unwrap
tagline: A Windows Script Host shim that turns Execute into a write
status: maintained
startedAt: 2025-05
technologies:
  - python
  - vbscript
  - windows
repository: https://github.com/codeblin/unwrap
featured: true
published: true
---

Layered VBScript droppers hide each successor behind `Execute`,
`ExecuteGlobal` or `Eval`. Running the sample to see the next layer is how
analysts get owned. `unwrap` replaces those sinks with a write to disk, so
each layer emits its successor instead of running it.

The method is the one in
[Four Layers of Nothing](/research/deobfuscating-a-vbs-dropper/).

## Design

A thin host sits in front of `wscript` / `cscript` and intercepts the
script-level sinks. The original source is never executed with those sinks
intact. Output is one file per layer, named and hashed, with a short
manifest of which sink fired and with how many bytes.

```filetree root="unwrap/"
host/
  shim.wsf
src/
  unwrap/
    detect.py
    layer.py
    report.py
tests/
  fixtures/
    layer1.vbs
    layer2.vbs
```

## Limits

Process-level sinks (`WScript.Shell.Run`, WMI `Win32_Process.Create`) are
detected and refused, not emulated. A sample that drops to a binary on the
first layer is out of scope; that is a different tool. Environment checks
that cause a silent exit are reported as checks, not bypassed — seeing that
the sample refused to run *is* the finding.

## Status

Maintained. The fixture corpus grows when a new generator shows up. No
ambition to become a full emulator.
