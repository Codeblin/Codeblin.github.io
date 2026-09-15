---
record: 7
title: Certificate Pinning That Actually Holds
subtitle: Most pinning implementations fail to one of four mistakes, none of which are
  cryptographic
excerpt: Pinning is easy to implement and easy to implement uselessly. Every failure I
  have found in production came from the same four mistakes — and all four are design
  errors, not crypto errors.
status: published
publishedAt: 2026-06-11
updatedAt: 2026-09-15
category: mobile-security
tags:
  - android
  - tls
  - frida
  - masvs
featured: true
---

Certificate pinning is a narrow control with a clear purpose: ensure that your
app talks only to a server presenting a key you already trust, so that adding a
certificate authority to the device's trust store is not enough to read your
traffic. It defends against one thing — a locally-trusted interception proxy —
and it defends against it well.

It is also, in my experience, the mobile control most likely to be present in
the codebase and absent in effect. Every failure I have found came from one of
four mistakes. None of them are cryptographic. All of them are decisions about
where the check sits and what happens when it fails.

## Mistake one: pinning the leaf certificate

The most common implementation pins the leaf certificate's hash. It works
perfectly until the certificate is renewed — typically ninety days later — at
which point every installed copy of the app stops working simultaneously.

The predictable consequence is not a security incident, it is an emergency
release. The one after that is a decision to disable pinning "temporarily."

Pin the public key rather than the certificate, and pin the intermediate
rather than the leaf. A renewed certificate normally carries the same key, and
a key rotation is something you schedule.

```kotlin title="NetworkModule.kt" lines="4-6"
val pinner = CertificatePinner.Builder()
    // SPKI hash of the intermediate, plus a scheduled backup pin.
    .add("api.example.com", "sha256/YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=")
    .add("api.example.com", "sha256/T+7dEwzUFDPy4mVIyGKl6xhF3rDkjLDMvyDBIXPqRIw=")
    .build()

val client = OkHttpClient.Builder()
    .certificatePinner(pinner)
    .build()
```

Two pins, not one. The second is a backup for a key you control but have not
deployed yet. A single pin means a lost key is an app-wide outage with no
recovery path short of a store release.

::::finding{id="MASVS-NETWORK-004" severity="medium" cwe="CWE-295" status="fixed" title="Single leaf-certificate pin with no backup"}
The application pinned the SHA-256 hash of the leaf certificate with no backup
pin. Certificate renewal would have caused a total connectivity failure for all
installed clients, with recovery requiring an expedited store release.

:::note{title="This is a reliability finding that becomes a security finding"}
The insecure outcome is not the pin itself — it is the near-certain decision to
remove pinning under outage pressure. Controls that break the product get
switched off, so a fragile pin is a control with a short expected lifetime.
:::
::::

## Mistake two: pinning in one place out of three

Apps rarely have one HTTP client. There is the main networking layer, and then
there is the WebView, the image loader, the crash reporter, the analytics SDK
and whatever the payments vendor bundled.

Pinning configured on the primary `OkHttpClient` covers exactly the traffic
that goes through it. The image loader with its own client, and the WebView
with its own entirely separate stack, are unpinned — and the WebView is often
where the authentication flow happens.

```filetree root="app/src/main/"
java/com/example/
  net/ApiClient.kt @ pinned
  media/ImageLoader.kt @ own OkHttpClient, not pinned
  web/AuthWebView.kt @ WebView, separate stack entirely
  telemetry/Reporter.kt @ vendor SDK, unknown internals
```

Enumerating every client is tedious and it is the actual work. The
network-security configuration helps here, because it applies at the platform
level rather than per-client:

```xml title="res/xml/network_security_config.xml"
<network-security-config>
    <domain-config>
        <domain includeSubdomains="true">api.example.com</domain>
        <pin-set expiration="2027-01-01">
            <pin digest="SHA-256">YLh1dUR9y6Kja30RrAn7JKnbQG/uEtLMkBgFF2Fuihg=</pin>
            <pin digest="SHA-256">T+7dEwzUFDPy4mVIyGKl6xhF3rDkjLDMvyDBIXPqRIw=</pin>
        </pin-set>
    </domain-config>
</network-security-config>
```

Note `expiration`. After that date the pin set stops being enforced, which is a
deliberate safety valve against permanently bricking clients — and a thing to
diary, because a pin set silently expires.

## Mistake three: catching the exception

This one is a single line and it removes the control entirely.

```kotlin title="The mistake"
try {
    return client.newCall(request).execute()
} catch (e: SSLPeerUnverifiedException) {
    // Fall back to an unpinned client so the app keeps working.
    return fallbackClient.newCall(request).execute()
}
```

A pinning failure means something is intercepting the connection. It is the
one circumstance in which the app must refuse to proceed. A fallback path
converts the control into a speed bump: the interception succeeds on the second
attempt.

The correct behaviour is to fail closed, surface a clear error, and not retry
on a different client. That will occasionally inconvenience a user behind a
corporate TLS-inspecting proxy, which is the intended and correct outcome.

:::warning{title="Look for the fallback, not the pin"}
When reviewing, finding the pin configuration proves very little. Trace what
happens on `SSLPeerUnverifiedException` — the presence of a recovery path is
the finding, and it is usually several files away from the pinning setup.
:::

## Mistake four: assuming pinning resists a local attacker

Pinning stops a network attacker with a trusted CA. It does not stop an
attacker with code execution on the device, and it was never going to.

Dynamic instrumentation replaces the verification function at runtime. From an
assessment perspective this is a routine step, and it is how you confirm what
the traffic actually contains:

```command note="Standard assessment step: instrument the app to observe its own traffic"
frida -U -f com.example.app -l bypass-pinning.js
```

That is not a vulnerability in the pinning implementation. It is the boundary
of the control, and confusing the two leads to bad decisions in both
directions — teams adding aggressive anti-instrumentation in the belief it
makes pinning stronger, and assessors reporting a bypass as a pinning defect.

| Attacker | Pinning helps | Why |
| :--- | :--- | :--- |
| Network position, no device access | Yes | Cannot present a pinned key |
| Trusted CA installed on device | Yes | This is the design case |
| Code execution on device | No | Can replace the check itself |
| Compromised server | No | The pinned key is the attacker's |

Rows three and four are not gaps to be closed by better pinning. They are
different problems requiring different controls, and part two of the storage
series covers what is available for the third.

## A review checklist

What I actually work through, in order:

1. Enumerate every HTTP client in the app, including SDKs and WebViews.
2. Confirm pins are SPKI hashes, on the intermediate, with at least one backup.
3. Check the pin set expiration date and whether anyone owns renewing it.
4. Trace the failure path for a verification error — look specifically for
   retry-with-different-client.
5. Confirm the failure surfaces to the user rather than degrading silently.
6. Verify empirically with an intercepting proxy and a device-trusted CA, which
   is the exact scenario the control exists for.

Step six is the only one that produces evidence rather than an opinion. Reading
the configuration tells you what was intended; running the interception tells
you what happens.

---

The pin extraction and comparison steps are automated in
[pinwalk](/projects/pinwalk/), which enumerates HTTP clients in a decompiled
APK and reports which of them have a pin set attached.
