---
record: 5
title: What Hardware Backing Actually Guarantees
subtitle: Part two — the Android Keystore, the difference between StrongBox and TEE, and
  the guarantee people think they are buying
excerpt: The Keystore does not make your data safe. It makes a key unextractable, which
  is a narrower and more useful property than most threat models assume. This is where
  the line actually falls.
status: published
publishedAt: 2025-11-24
updatedAt: 2026-01-15
category: mobile-security
tags:
  - android
  - keystore
  - masvs
cover:
  src: ./media/d1ec812b3344eadd4b5f28136860fe35.jpg
  alt: What Hardware Backing Actually Guarantees
series:
  id: android-storage
  order: 2
featured: false
---

Part one established that everything in an app's private directory is cleartext
to an attacker with root. The natural response is encryption, and the natural
follow-up question is where the key goes — because a key stored next to the
ciphertext it protects is not a control, it is a formality.

The Android Keystore is the answer, but it answers a narrower question than the
one most threat models ask. Getting precise about which question is the
difference between a control that holds and a control that reads well in a
design document.

This is part two of three. Part one mapped
[where secrets actually live](/research/android-storage-where-secrets-actually-live/);
part three covers
[what survives a backup, a root and an uninstall](/research/what-survives-android-backup-and-root/).

## The guarantee, stated precisely

The Keystore's property is **key non-extractability**. A key generated inside
it never exists as bytes in your process, and cannot be exported. You do not
hold the key; you hold a handle, and you ask the system to perform operations
with it on your behalf.

```kotlin title="KeyVault.kt" lines="5-9"
private fun generateKey(alias: String): SecretKey {
    val generator = KeyGenerator.getInstance(
        KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
    )
    generator.init(
        KeyGenParameterSpec.Builder(alias, PURPOSE_ENCRYPT or PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setUserAuthenticationRequired(true)
            .build()
    )
    return generator.generateKey()
}
```

Note what the returned `SecretKey` is: a reference. Calling `getEncoded()` on
it returns `null`. That null is the entire feature.

:::note{title="Non-extractability is not confidentiality of your data"}
An attacker with root cannot steal the key. They can, however, still be *on the
device*, and the Keystore will happily perform operations for any caller that
can satisfy its access conditions. The guarantee protects the key's portability
off the device — not the plaintext's confidentiality on it.
:::

## TEE and StrongBox are not the same claim

Two hardware tiers exist, and the difference is material.

| Tier | Where the key lives | Resists |
| :--- | :--- | :--- |
| Software-only | Encrypted blob in the filesystem, key derived from device credentials | Casual filesystem reads |
| TEE | A trusted execution environment on the main application processor | Root, kernel compromise of the normal world |
| StrongBox | A discrete, physically separate secure element | The above, plus a range of physical attacks |

The important line is between software-only and TEE: below it, the key material
is ultimately a file, and the non-extractability claim degrades to "encrypted
with something else that is also on the device." Above it, the key genuinely
never enters the normal world.

You have to ask which tier you got, because the API does not fail loudly when
it gives you less than you requested.

```kotlin title="Verifying what you were actually given"
val factory = SecretKeyFactory.getInstance(key.algorithm, "AndroidKeyStore")
val info = factory.getKeySpec(key, KeyInfo::class.java) as KeyInfo

// Prior to API 31 this is isInsideSecureHardware; after, use getSecurityLevel().
val level = info.securityLevel   // SECURITY_LEVEL_STRONGBOX / TRUSTED_ENVIRONMENT / SOFTWARE
```

::::finding{id="MASVS-CRYPTO-002" severity="medium" cwe="CWE-320" status="fixed" title="StrongBox requested without verifying the fallback tier"}
The application called `setIsStrongBoxBacked(true)` inside a `try` block and
caught `StrongBoxUnavailableException` by regenerating the key with the flag
removed — with no logging, no attestation check and no adjustment to the
protections that depended on it.

On devices without a secure element the key silently landed in the TEE, or in
software on older hardware, while the application's risk decisions continued to
assume StrongBox.

:::note{title="Fail visibly, or design for the floor"}
Either verify the tier you received and degrade the feature accordingly, or
design assuming the weakest tier you support. Silently accepting a lower tier
while keeping StrongBox-grade assumptions is the actual defect.
:::
::::

## The controls that do the work

Non-extractability alone stops key theft, not key *use*. The properties that
constrain use are the ones worth arguing about in design review.

- **`setUserAuthenticationRequired(true)`** — the key cannot be used unless the
  user has authenticated recently. This is the single most valuable flag,
  because it binds key use to a human rather than to a process.
- **`setUserAuthenticationParameters(timeout, type)`** — how recently, and by
  what means. A generous timeout quietly undoes the previous flag.
- **`setUnlockedDeviceRequired(true)`** — no operations while the device is
  locked. Cheap, and closes the acquired-while-locked case.
- **`setInvalidatedByBiometricEnrollment(true)`** — the key dies if a new
  biometric is enrolled, so adding a fingerprint cannot inherit access.
- **Attestation** — a signed statement from the hardware about the key's
  properties, verifiable off-device. The only way a server can know what tier
  a client key really has.

:::warning{title="An authentication-bound key still runs for root, after unlock"}
`setUserAuthenticationRequired` means the *device* was authenticated within the
window, not that your app requested it. An attacker with code execution on an
unlocked device, inside the validity window, can ask the Keystore to decrypt.
Shorter windows and per-operation binding via `CryptoObject` narrow this
considerably; nothing removes it.
:::

## Where this leaves the storage problem

Combining part one's map with the above gives a defensible position:

1. Generate a key in the Keystore, hardware-backed, with authentication
   required and a short validity window.
2. Verify the tier you were actually given, and record it.
3. Encrypt sensitive values with that key before they touch
   `shared_prefs`, a database, or a file.
4. Accept the residual: an attacker with code execution on an unlocked device
   inside the window can still obtain plaintext.

That residual is not a failure of the design. It is the correct, honest
boundary of what device-side storage protection can achieve, and stating it
plainly is more useful to a client than claiming the data is "encrypted at
rest" and leaving them to infer more than that means.

The remaining question is what happens to all of this when data leaves the
device through channels that are not attacks at all — backup, migration,
uninstall. That is part three.

---

Continue to part three:
[what survives a backup, a root and an uninstall](/research/what-survives-android-backup-and-root/).
