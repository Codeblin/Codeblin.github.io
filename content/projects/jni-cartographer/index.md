---
record: 1
name: jni-cartographer
tagline: Recover a stripped Android library's JNI map before you start reading it
status: active
startedAt: 2025-03
technologies:
  - python
  - ghidra
  - android
  - jni
repository: https://github.com/codeblin/jni-cartographer
featured: true
published: true
---

A Ghidra script plus a small CLI that turns a stripped `arm64-v8a` library
into a named JNI surface: `JNI_OnLoad`, the `RegisterNatives` table, and a
typed stub for every registered method.

The method is described in
[Reading Android Native Libraries in Ghidra](/research/reading-native-libraries-in-ghidra/).
This project is that method made repeatable across build variants.

## What it does

1. Locates `JNI_OnLoad` or the exported initialiser.
2. Defines `JNINativeMethod` and applies it to the registration array when
   the array is a static literal.
3. Renames each `fnPtr` from the Java method name in the table.
4. Applies the JNI type archive so environment-pointer calls resolve to API
   names rather than offsets.
5. Emits a JSON map `{javaName, signature, address}` for the rest of the
   toolchain.

## What it refuses to do

It will not invent names for functions that are not in the table. If the
library builds the registration array on the stack from decrypted strings,
the script reports that fact and stops. The right next step is a debugger,
not a guess.

```filetree root="jni-cartographer/"
ghidra_scripts/
  RecoverJni.py
src/
  cartographer/
    elf.py
    jni.py
    report.py
tests/
  fixtures/
cli.py
```

## Status

Used on every Android native assessment I run. The static path is solid; the
constructed-table path is documented as out of scope and will stay that way
until it can be done without pretending.
