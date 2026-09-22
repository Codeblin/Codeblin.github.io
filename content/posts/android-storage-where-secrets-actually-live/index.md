---
record: 4
title: Where Android Secrets Actually Live
subtitle: Part one — mapping every place an application can put sensitive data, and
  which of them survive filesystem access
excerpt: Before deciding whether an app protects its secrets, you have to know where it
  keeps them. This is a complete map of Android storage locations, ranked by what an
  attacker with filesystem access can read.
status: published
publishedAt: 2025-07-08
category: mobile-security
tags:
  - android
  - masvs
  - static-analysis
cover:
  src: ./media/2def7071cf45575ed85072b54f361517.jpg
  alt: Where Android Secrets Actually Live
series:
  id: android-storage
  order: 1
featured: true
---

Every mobile assessment includes some version of the sentence "sensitive data
must be stored securely," and every version of it is useless until you can
answer a prior question: where does this application actually put things? An
app has more storage locations available to it than most developers realise,
and they do not offer the same protection. Getting the map right is the whole
first half of the work.

This is part one of three. Here we build the map. Part two examines the
[Keystore and what hardware backing really guarantees](/research/android-keystore-what-hardware-backing-guarantees/);
part three covers
[what survives a backup, a root, and an uninstall](/research/what-survives-android-backup-and-root/).

## The threat model determines everything

"Securely" is meaningless without an attacker. Three are worth separating,
because a location that is safe against one is wide open to another.

| Attacker | Access | Realistic for |
| :--- | :--- | :--- |
| Co-resident app | Its own sandbox, plus anything world-readable or exported | Any device |
| Backup extraction | Whatever `allowBackup` exposes | Any non-rooted device with USB debugging |
| Filesystem access | The entire data directory, cleartext | Rooted, stolen-and-imaged, or compromised device |

Most storage advice silently assumes the first attacker. The interesting
findings almost always come from taking the third seriously, because on a
rooted or physically-acquired device the sandbox is not a boundary at all.

:::note{title="The sandbox is an OS control, not a cryptographic one"}
Android's per-app UID isolation is enforced by the kernel. It is real and it is
strong — right up until someone has root, at which point every file in every
app's private directory is a plain `cat` away. Storage decisions have to be
evaluated against the world where that has already happened.
:::

## The private data directory

The default home for an app's files is `/data/data/<package>/`, readable only
by the app's UID. Within it, a few conventional subdirectories:

```filetree root="/data/data/com.example.app/"
databases/
  app.db @ SQLite; the usual home for structured data
shared_prefs/
  settings.xml @ XML key-value; frequently misused for tokens
files/
  cache/ @ app-managed scratch space
no_backup/ @ excluded from auto-backup by design
```

Everything here is protected by the sandbox and nothing here is encrypted by
default. `shared_prefs` deserves special suspicion: it is the easiest storage
API to reach, so it is where access tokens, PINs and "remember me" flags
accumulate — in cleartext XML that any root-level attacker reads instantly.

```terminal host="test-device (rooted)" exit="0"
$ run-as com.example.app cat shared_prefs/auth.xml
<?xml version='1.0' encoding='utf-8'?>
<map>
  <string name="access_token">eyJhbGciOiJI...</string>
  <boolean name="biometric_enabled" value="true" />
</map>
```

A bearer token sitting in `shared_prefs` is the single most common storage
finding in Android assessments, and it is a genuine finding: the sandbox does
not protect it against the attacker who matters most.

::::finding{id="MASVS-STORAGE-001" severity="high" cwe="CWE-312" status="open" title="Access token stored in cleartext SharedPreferences"}
The application persists an OAuth access token as a plaintext string in
`shared_prefs`. On a rooted or imaged device the token is directly readable and
replayable until expiry, defeating device-loss protections.

:::note{title="The fix is not 'encrypt the XML'"}
Wrapping the same value with a key that also lives on the device only moves the
problem. Part two covers why the key's *location* is the actual control, and
what the Keystore does and does not solve here.
:::
::::

## External and shared storage

Anything written to shared or external storage is, historically, readable by
any app and by anyone with the device. Scoped storage on modern Android narrows
this considerably, but legacy paths, `requestLegacyExternalStorage`, and media
directories still leak. The rule is unchanged: shared storage is public
storage, and nothing sensitive belongs there regardless of the API generation.

## The places people forget

The obvious locations get audited. These do not, and they are where the
surprising findings live.

- **Logs.** `Log.d` output persists in the system log buffer, and on many
  builds it is readable further than developers assume. Tokens and request
  bodies logged "temporarily" during development have a way of shipping.
- **WebView.** Its own cache, cookie store, local storage and IndexedDB sit
  under the app directory in cleartext, entirely outside whatever the app's
  own storage layer does.
- **Auto-generated backups.** Covered in part three, but flagged here: with
  `allowBackup` unset, the default is *on*, and it can copy the entire private
  directory off the device without root.
- **In-memory, then swapped or hibernated.** Beyond static storage, but a
  secret held in a `String` lingers in the heap and in any memory dump far
  longer than intended.

:::warning{title="Grep is a first pass, not a conclusion"}
Pulling the data directory and grepping for `token`, `password` and `secret`
finds the careless cases and misses the encoded ones. A base64 or hex blob in
`shared_prefs` reveals nothing to `grep` and everything to two seconds of
decoding. Absence of a plaintext hit is not evidence of protection.
:::

## The map, ranked

Against the attacker who matters — filesystem access on a rooted or acquired
device — the locations rank cleanly:

1. **Keystore-held key material** — the only option that can keep a secret from
   a filesystem attacker, and only under conditions part two makes precise.
2. **`no_backup/` private files** — sandboxed and excluded from backup, but
   still cleartext to root.
3. **Databases and `shared_prefs`** — sandboxed, cleartext, backup-exposed
   unless explicitly excluded.
4. **WebView storage and logs** — sandboxed but easily overlooked and
   frequently leaky.
5. **External and shared storage** — treat as public.

Everything below the first line is cleartext to the attacker with root. That is
not a reason to despair; it is the reason the next part exists. The question
becomes: can any key be kept somewhere the filesystem attacker cannot follow?

---

Continue to part two:
[the Keystore and what hardware backing actually guarantees](/research/android-keystore-what-hardware-backing-guarantees/).
