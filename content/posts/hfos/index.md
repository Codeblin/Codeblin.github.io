---
record: 10
title: HFOS
subtitle: TEst
excerpt: dsadasa
status: published
publishedAt: 2026-09-22
updatedAt: 2026-09-22
category: mobile-security
tags: []
cover:
  src: ./media/1387402c72027daedfc9f1f2dd1e759c.jpg
  alt: HFOS
featured: true
---

This is a post

:::tip{title="OK"}
this is a pipe
:::

```kotlin title=".kt"
if(){
 ds
}
```

```mermaid caption="Diagram"
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ ORDER_ITEM : contains
    PRODUCT ||--o{ ORDER_ITEM : includes
    CUSTOMER {
        string id
        string name
        string email
    }
    ORDER {
        string id
        date orderDate
        string status
    }
    PRODUCT {
        string id
        string name
        float price
    }
    ORDER_ITEM {
        int quantity
        float price
    }
```

:::finding{id="dsd" severity="medium" cwe="CWE-5435" title="te"}
fsds
:::
