---
record: 1
title: Reading Android Native Libraries in Ghidra
subtitle: A working method for getting from a stripped arm64 .so to a readable model of what it does
excerpt: >-
  Most Android reverse engineering advice stops at jadx. When the interesting
  logic has been pushed into a stripped native library, you need a different
  approach: recover the JNI boundary first, then work inward.
status: published
publishedAt: 2024-11-12
updatedAt: 2025-03-04
category: reverse-engineering
tags:
  - android
  - ghidra
  - static-analysis
featured: false
---

Every few months an application arrives where the Java side is deliberately
uninteresting. The activities are thin, the networking is a single generic
wrapper, and every decision worth understanding happens behind a `native`
method declaration. The vendor has moved the logic into a shared object,
stripped it, and assumed that is the end of the conversation.

It is not, but the method has to change. Decompiling Dalvik bytecode gives you
something close to the original source. Decompiling stripped arm64 gives you a
wall of `FUN_00108a4c` calls operating on `undefined8` values. The difference
is not difficulty, it is that you no longer get names for free. Everything
below is about manufacturing those names.

## Start at the boundary, not the entry point

The instinct is to find `main`, or the library's initialiser, and read forward.
That is the wrong end. A native library shipped inside an APK exists to serve
the Java code above it, and that interface is the one part of the binary that
cannot be obfuscated away: the runtime has to be able to find it.

There are two ways a library exposes methods to the JVM, and you want to know
which one you are dealing with before you open the decompiler.

:::note{title="Static binding versus RegisterNatives"}
Static binding means exported symbols named `Java_com_example_Crypto_sign`.
`RegisterNatives` means a table of `{name, signature, functionPointer}` structs
handed to the runtime at load time. The second is more common in anything
written after about 2018, and more common still in anything trying to be
awkward.
:::

Check the exports first. It costs one command.

```terminal host="workstation" exit="0"
$ unzip -o app.apk 'lib/arm64-v8a/*' -d unpacked
  inflating: unpacked/lib/arm64-v8a/libcore.so
$ nm -D --defined-only unpacked/lib/arm64-v8a/libcore.so | rg '^.{18}T Java_'
0000000000108a4c T Java_com_example_core_Crypto_nativeInit
$ nm -D --defined-only unpacked/lib/arm64-v8a/libcore.so | wc -l
14
```

One statically bound method and fourteen exports total, against a Java class
with nine `native` declarations. The other eight are registered at runtime.
That single exported `nativeInit` is almost certainly where the registration
happens, which makes it the first function to read.

## Recovering the registration table

`RegisterNatives` takes an array of `JNINativeMethod`, and that struct is three
pointers wide on arm64:

```c title="jni.h (abridged)"
typedef struct {
    const char *name;       /* "sign" */
    const char *signature;  /* "([B)[B" */
    void       *fnPtr;      /* the implementation */
} JNINativeMethod;
```

In Ghidra, define that structure once and apply it to the array the
initialiser passes. The decompiler output goes from an opaque pointer walk to a
labelled table, and every function pointer in it becomes a named symbol you can
follow. This is the single highest-leverage action in the whole process: eight
anonymous functions acquire real names in about two minutes.

::::finding{id="RE-BOUNDARY-001" severity="info" status="open" title="The JNI table is a free symbol map"}
Any library using `RegisterNatives` must build a table of human-readable method
names and JNI signatures in memory before registration. Obfuscators rarely
touch it, because breaking it breaks the application. Recovering the table
recovers the names the authors used.

:::note{title="When the table is built at runtime"}
Some packers assemble the struct array on the stack from decrypted strings. The
table still exists — it is just constructed rather than static. Breakpoint the
`RegisterNatives` call in a debugger and read it from memory instead.
:::
::::

The signatures matter as much as the names. `([B)[B` tells you the function
takes a byte array and returns one, so the two `undefined8` parameters after
`JNIEnv*` and `jobject` are a `jbyteArray` and nothing else. Type them and the
decompiler propagates that knowledge through every call downstream.

## Typing JNIEnv is not optional

Ghidra ships a JNI data type archive. Apply it. Untyped, every call through the
environment pointer looks like this:

```c title="Before typing"
lVar3 = (**(code **)(*param_1 + 0x2e0))(param_1, param_3, 0);
```

Typed, the same line reads as `GetByteArrayElements`. The offset `0x2e0` is an
index into the `JNINativeInterface` function table, and the archive knows what
lives at every offset. There is no cleverness here, only the difference between
reading three hundred lines of pointer arithmetic and reading three hundred
lines of API calls.

| Offset | Function | What it tells you |
| :--- | :--- | :--- |
| `0x2e0` | `GetByteArrayElements` | A byte array is about to be read directly |
| `0x548` | `GetStringUTFChars` | A Java string crosses into native code |
| `0x35c` | `NewByteArray` | The return value is being constructed |
| `0x6a0` | `FindClass` | A callback into Java is being set up |

That last one is worth flagging when you see it. A native library that calls
`FindClass` is not a leaf; it reaches back up into Java, and the control flow
you reconstruct in Ghidra alone will be incomplete.

## The parts that stay hard

Two things resist this method, and it is worth being honest about them rather
than pretending the workflow is complete.

The first is control-flow flattening. If the library was built with a hardening
toolchain, every function becomes a dispatch loop over a state variable and the
decompiler output stops resembling a program. Static reading alone will not
recover it; you need traced execution to establish which state transitions
actually occur.

The second is anything that only exists after decryption. String tables,
embedded key material and sometimes whole functions are unpacked at load time.
The disassembly you are reading is not the code that runs.

:::warning{title="Verify statically recovered constants dynamically"}
A key or endpoint recovered from a static blob is a hypothesis, not a finding.
Confirm it against a running process before writing it into a report — the
value in the file is frequently not the value in memory.
:::

## A checklist that has held up

The order matters more than any individual step. Each one makes the next
cheaper.

1. Extract the ABI-appropriate library and list dynamic exports.
2. Locate `JNI_OnLoad` or the exported initialiser.
3. Define `JNINativeMethod`, apply it to the registration array, rename the
   targets.
4. Apply the JNI type archive so environment calls resolve to API names.
5. Type the arguments of each registered function from its JNI signature.
6. Only now start reading the implementation.

```command note="Ghidra headless import, useful when repeating this across build variants"
analyzeHeadless ./project core -import libcore.so -postScript recover_jni.py
```

Steps one through five are mechanical, and they are what makes step six
tractable. Skipping straight to the decompiler is the reason native analysis
has a reputation for being an order of magnitude harder than it is.

---

The `recover_jni.py` script referenced above lives in
[jni-cartographer](/projects/jni-cartographer/), which automates steps two
through five for libraries that build their registration table statically.
