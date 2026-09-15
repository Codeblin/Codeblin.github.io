A paragraph of ordinary prose with **emphasis**, a [link](https://example.com/thing)
and some `inline code` in it.

## Initial analysis

Prose under a heading.

### A nested heading

```kotlin title="Store.kt" lines="3-4" start="1"
class Store(context: Context) {
    private val db = openOrCreateDatabase("store", MODE_PRIVATE, null)

    fun put(key: String, value: String) =
        db.execSQL("INSERT INTO kv VALUES (?, ?)", arrayOf(key, value))
}
```

```terminal host="analysis-vm" exit="1"
$ jadx -d out app.apk
INFO  - loading ...
$ rg -n "password" out/sources
out/sources/com/example/Store.java:41
```

```http-request
POST /api/v1/auth HTTP/1.1
Host: api.example.com
Content-Type: application/json

{"username":"analyst"}
```

```http-response
HTTP/1.1 200 OK
Content-Type: application/json

{"token":"..."}
```

```filetree root="app/"
src/
  main/
    AndroidManifest.xml @ exported activity, no permission
  test/
build.gradle.kts
```

```command note="Attach to the running process"
frida -U -n com.example.app -l hook.js
```

```diagram caption="Request path through the pinning layer"
client ──▶ okhttp ──▶ pinner ──▶ socket
              │
              └──▶ trust store
```

::::finding{id="MASVS-STORAGE-001" severity="high" cwe="CWE-312" cvss="7.5" status="fixed" title="Credentials stored in plain text"}
Sensitive session material is written to the application database without
encryption.

```sql
SELECT * FROM kv WHERE key = 'session';
```

:::warning{title="Do not run this against production"}
The sample calls out to a live endpoint on execution.
:::
::::

:::note{title="On scope"}
This applies only to builds before 4.2.
:::

:::image{src="./media/decoded.png" alt="The fourth decode stage, finally readable" width="wide"}
The fourth decode stage, finally readable.
:::

:::gallery{columns="3"}
::item{src="./media/one.png" alt="Entry point"}

::item{src="./media/two.png" alt="Decode loop"}

::item{src="./media/three.png" alt="Payload"}
:::

> A plain block quote spanning
> two lines.

:::quote{cite="OWASP MASVS" href="https://mas.owasp.org/"}
The app should not store sensitive data in plain text.
:::

| Field | Value | Notes |
| :--- | ---: | --- |
| Severity | High | Confirmed |
| CWE | CWE-312 | Cleartext storage |

- An unordered item
- Another item with `code`

1. First ordered item
2. Second ordered item

::video{src="./media/capture.mp4" poster="./media/capture.png" caption="Hooking the pinner at runtime"}

::embed{provider="youtube" ref="dQw4w9WgXcQ" title="Talk recording"}

---

::divider{variant="dots"}

A closing paragraph.
