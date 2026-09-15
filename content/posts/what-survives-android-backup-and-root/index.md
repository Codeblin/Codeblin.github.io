---
record: 6
title: What Survives a Backup, a Root and an Uninstall
subtitle: Part three — data leaving the device through channels that were never attacks
excerpt: >-
  Backup, migration and uninstall are features, not exploits. They are also the
  most reliable way sensitive data leaves a device, and the defaults are not
  the ones you would choose.
status: published
publishedAt: 2026-03-17
category: mobile-security
tags:
  - android
  - masvs
  - keystore
series:
  id: android-storage
  order: 3
featured: false
---

The first two parts of this series assumed an adversary. Part one mapped
[where secrets live](/research/android-storage-where-secrets-actually-live/)
against an attacker with filesystem access; part two examined
[what the Keystore guarantees](/research/android-keystore-what-hardware-backing-guarantees/)
against one with code execution.

This part has no adversary in it. Backup, device migration and uninstall are
ordinary platform features working exactly as designed. They are also, in my
experience, the most reliable way sensitive data ends up somewhere nobody
intended — because they operate by default, without a prompt, and outside
whatever your storage layer thinks it is doing.

## The default is on

The single most consequential line in an Android manifest is one that usually
is not there.

```xml title="AndroidManifest.xml"
<application
    android:allowBackup="true"
    android:fullBackupContent="@xml/backup_rules">
```

`allowBackup` defaults to `true`. Omit it and you have opted in. What that
means concretely: the platform may copy your app's private data directory —
`databases/`, `shared_prefs/`, `files/` — to Google's servers or to a
locally-connected machine, and restore it onto a different device later.

Every conclusion from part one now needs revisiting. The sandbox protected
those files from other apps. It does not protect them from a feature whose
entire purpose is to copy them off the device.

```terminal host="workstation" exit="0"
$ adb backup -f out.ab -noapk com.example.app
Now unlock your device and confirm the backup operation.
$ dd if=out.ab bs=24 skip=1 | zlib-flate -uncompress > out.tar
$ tar tf out.tar | rg 'shared_prefs|databases'
apps/com.example.app/sp/auth.xml
apps/com.example.app/db/app.db
```

No root, no exploit. A cable, a confirmation tap, and the cleartext token from
part one is on a laptop. On modern Android the `adb backup` path is
increasingly restricted, but cloud backup and device-to-device transfer are
not — they are the same data through a channel you cannot see.

::::finding{id="MASVS-STORAGE-002" severity="medium" cwe="CWE-530" status="fixed" title="Sensitive preferences included in platform backup"}
The application left `allowBackup` at its default and defined no backup rules,
so `shared_prefs/auth.xml` — containing a bearer token and biometric
enrolment state — was included in platform backup and restored onto
replacement devices.

:::note{title="Restore is the underrated half"}
Extraction gets the attention, but restore is often the sharper edge: state
written on one device arrives on another, which quietly breaks any assumption
that a stored credential is bound to the hardware that created it.
:::
::::

## Excluding things properly

There are two mechanisms, and you need both because they apply to different
Android versions.

```xml title="res/xml/backup_rules.xml"
<full-backup-content>
    <exclude domain="sharedpref" path="auth.xml" />
    <exclude domain="database" path="app.db" />
</full-backup-content>
```

```xml title="res/xml/data_extraction_rules.xml"
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="sharedpref" path="auth.xml" />
    </cloud-backup>
    <device-transfer>
        <exclude domain="sharedpref" path="auth.xml" />
    </device-transfer>
</data-extraction-rules>
```

Note that the newer format separates cloud backup from device-to-device
transfer. They are different channels with different risk profiles, and a rule
set that covers one and not the other is a common oversight — direct transfer
is frequently left permissive because it feels local and therefore safe.

The simpler option, where it fits the design, is to put nothing sensitive in a
backed-up location at all: the `no_backup/` directory is excluded by
construction, and there is nothing to forget.

:::warning{title="Verify exclusions against a real backup"}
Backup rules are configuration, and configuration is asserted rather than
enforced. The only way to know a file is excluded is to take a backup and look.
I have reviewed several apps with correct-looking rules and the sensitive file
present in the archive, usually because the path or domain did not match what
the file actually was.
:::

## Why Keystore-wrapped data behaves differently

Here the two previous parts pay off. A Keystore key is not in the filesystem,
so it is not in the backup. Restore a database encrypted with a hardware-backed
key onto a new device and the ciphertext arrives without the key — permanently
undecryptable.

That is usually the correct outcome, and it is worth stating as a design
principle rather than a bug: **encrypting with a non-exportable device key
makes data non-portable by construction.** You get backup exclusion for free,
because the platform cannot carry the key even when it carries the file.

It does mean the app must handle the case gracefully. An app that crashes on
first launch after a restore because it cannot decrypt its own database is a
real and frequent failure.

| Scenario | Ciphertext | Key | Outcome |
| :--- | :--- | :--- | :--- |
| Same device, normal launch | Present | Available | Decrypts |
| Restored to new device | Present | Absent | Must re-authenticate |
| New biometric enrolled | Present | Invalidated | Must re-authenticate |
| Uninstall and reinstall | Absent | Absent | Clean state |

The three rows that end in re-authentication are the same code path, which is
convenient: build it once and all three are handled.

## Uninstall is cleaner than expected, with exceptions

Uninstalling removes the private data directory and the app's Keystore
entries. That part is genuinely clean. The exceptions are the locations from
part one that were never in the private directory:

- Files the app wrote to shared or external storage persist.
- Data already synced to a backend persists, obviously, and is outside this
  discussion but inside the user's expectation of "I deleted the app."
- Backup archives already taken persist, and a reinstall may restore them —
  meaning "uninstall to clear state" does not reliably clear state.

That last one produces genuinely confusing behaviour: a user uninstalls to
resolve a problem, reinstalls, and the platform helpfully restores the exact
state that caused it.

## The series, in one page

Across three parts, the position that has held up:

1. Treat the filesystem as readable. The sandbox is an OS control, and root
   removes it.
2. Put nothing sensitive in cleartext, anywhere in the private directory.
3. Encrypt with a Keystore key, hardware-backed, authentication-bound, with a
   short validity window — and verify the tier you were actually given.
4. Exclude sensitive paths from both backup channels explicitly, then take a
   backup and confirm.
5. Handle key-unavailable as a normal path, not an error: restore, biometric
   re-enrolment and reinstall all arrive there.
6. State the residual risk honestly. Code execution on an unlocked device
   inside the authentication window still yields plaintext, and no storage
   design changes that.

Point six is the one worth repeating to anyone who wants "encrypted at rest"
written in a report and treated as settled. It is a meaningful control with a
specific boundary, and the boundary is where the useful conversation starts.
