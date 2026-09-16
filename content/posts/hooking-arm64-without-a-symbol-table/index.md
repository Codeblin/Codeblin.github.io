---
record: 8
title: Hooking arm64 Without a Symbol Table
subtitle: Finding an interception point in a stripped library when there is no name to attach to
excerpt: "Instrumentation tutorials assume you can name the function you want to hook.
  This is what remains when the symbol table is gone: exports, imports, the JNI table,
  and why pattern scanning is a last resort rather than a method."
status: draft
updatedAt: 2026-09-16
category: reverse-engineering
tags:
  - frida
  - android
  - dynamic-analysis
featured: false
draftNotes: Needs the section on PLT/GOT interception rewritten — the current draft
  conflates import hooking with inline patching. Also want a worked example against a
  library that resolves its own imports lazily. Do not publish until the
  pattern-scanning section has been verified on a 16 KB page-size device.
---

Every dynamic instrumentation guide starts the same way: attach to the process,
name the function, replace it. That works because the examples use libraries
with symbol tables. The libraries worth instrumenting usually do not have one.

This is about the gap between those two situations — what handles remain when
the names are gone, and which of them are worth using before anyone reaches for
a byte pattern.

## What stripping actually removes

Stripping removes the symbol table. It does not remove the things the loader
and the runtime still have to find by name:

- **Dynamic exports.** Anything the library must expose for `dlopen` /
  `dlsym` is still named, because resolution happens by name at runtime.
- **Imports.** Calls out to `libc`, `liblog` or `libssl` go through the PLT
  and are resolved by name. Every one is a nameable interception point.
- **The JNI registration table.** Covered in
  [Reading Android Native Libraries in Ghidra](/research/reading-native-libraries-in-ghidra/).
  If the library talks to Java, the table of `{name, signature, fnPtr}` is
  built in memory before `RegisterNatives` is called — and those names are
  the authors' names.

The method is to exhaust those three before inventing a fourth.

## Start with the exports you still have

```terminal host="workstation" exit="0"
$ llvm-nm -D --defined-only libcore.so | rg ' T '
00000000000108a4c T JNI_OnLoad
0000000000010b210 T Java_com_example_core_Crypto_nativeInit
```

Two names. `JNI_OnLoad` is almost always the registration site, which makes
it the first function to read rather than the first function to hook. The
goal at this stage is not interception; it is a map.

Once the registration table is recovered — statically in Ghidra, or by
breaking on `RegisterNatives` in a debugger and reading the array from
memory — every JNI-exported function has a name again. That is usually the
entire interesting surface of an Android native library.

## Imports are a back door into unnamed code

A stripped function that calls `HMAC` or `EVP_DecryptUpdate` still has to
call it through the PLT. Intercepting the *import* tells you which unnamed
function is doing cryptographic work, without needing that function's name.

This is the right altitude for a lot of assessment work. You rarely need to
replace the application's own routine. You need to observe what it passes to
a library you already understand.

:::note{title="Lazy binding changes when the slot is written"}
On a lazily-bound import the GOT slot is not the real destination until the
first call. Intercepting too early observes the resolver rather than the
function. The reliable moment is after the library has been used at least
once, or after forcing eager binding for the session.
:::

## Pattern scanning is a last resort

When a function has no export, no import of interest, and no JNI name, the
remaining handle is a byte sequence unique enough to find in memory. This is
fragile in ways the previous methods are not:

- A compiler upgrade, a new optimisation level or a different NDK version
  changes the bytes.
- 16 KB page-size devices (Android 15 onwards, on some hardware) change
  alignment and can shift relative immediates.
- Thumb vs AArch64 is obvious; less obvious is that the same source compiled
  `-Os` versus `-O2` is a different pattern.

If you do end up here, treat the pattern as a *locator for a session*, not as
an artefact you ship. Re-derive it from the binary in front of you; do not
reuse one from a previous build.

:::warning{title="A pattern is a hypothesis about one build"}
Reporting "we hooked function X via pattern Y" is only meaningful attached to
a specific hash of `libcore.so`. The next version of the app is a different
program. Re-establish the map; do not assume the old one.
:::

## A working order

The order is the method. Each step makes the next one less necessary.

1. List dynamic exports. Read `JNI_OnLoad` / the exported initialiser.
2. Recover the `RegisterNatives` table — statically if it is a literal,
   dynamically if it is constructed.
3. Type the JNI signatures so the unnamed implementations acquire argument
   names.
4. Identify interesting imports (crypto, I/O, logging) and observe those
   rather than the application's own wrappers.
5. Only then consider a session-local pattern to locate something with no
   other handle.

Steps one through four are how most native assessment work actually gets
done. Step five is what the tutorials lead with, and it is the part that
ages worst.

---

The JNI recovery in steps 1–3 is automated for statically-built tables by
[jni-cartographer](/projects/jni-cartographer/). Pattern scanning is
deliberately not: a locator that has to be re-derived per build should not
look like a finished tool.
