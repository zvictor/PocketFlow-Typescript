---
layout: default
title: 'Communication'
parent: 'Core Abstraction'
nav_order: 3
---

# Communication

Nodes and Flows **communicate** in 2 ways:

1. **Shared Store (for almost all the cases)**

   - A global data structure (often an in-mem dict) that all nodes can read ( `prep()`) and write (`post()`).
   - Great for data results, large content, or anything multiple nodes need.
   - You shall design the data structure and populate it ahead.
     {% hint style="success" %}
     **Separation of Concerns:** Use `Shared Store` for almost all cases to separate _Data Schema_ from _Compute Logic_! This approach is both flexible and easy to manage, resulting in more maintainable code. `Params` is more a syntax sugar for [Batch](./batch.md).
     {% endhint %}

2. **Params (only for [Batch](./batch.md))**
   - Each node has a local, ephemeral `params` dict passed in by the **parent Flow**, used as an identifier for tasks. Parameter keys and values shall be **immutable**.
   - Good for identifiers like filenames or numeric IDs, in Batch mode.

If you know memory management, think of the **Shared Store** like a **heap** (shared by all function calls), and **Params** like a **stack** (assigned by the caller).

---

## 1. Shared Store

### Overview

A shared store is typically an in-mem dictionary, like:

{% tabs %}
{% tab title="Python" %}

```python
shared = {"data": {}, "summary": {}, "config": {...}, ...}
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
const shared = {
  data: {},
  summary: {},
  config: {...},
  // ...
}
```

{% endtab %}
{% endtabs %}

It can also contain local file handlers, DB connections, or a combination for persistence. We recommend deciding the data structure or DB schema first based on your app requirements.

### Example

{% tabs %}
{% tab title="Python" %}

```python
class LoadData(Node):
    def post(self, shared, prep_res, exec_res):
        # We write data to shared store
        shared["data"] = "Some text content"
        return None

class Summarize(Node):
    def prep(self, shared):
        # We read data from shared store
        return shared["data"]

    def exec(self, prep_res):
        # Call LLM to summarize
        prompt = f"Summarize: {prep_res}"
        summary = call_llm(prompt)
        return summary

    def post(self, shared, prep_res, exec_res):
        # We write summary to shared store
        shared["summary"] = exec_res
        return "default"

load_data = LoadData()
summarize = Summarize()
load_data >> summarize
flow = Flow(start=load_data)

shared = {}
flow.run(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class LoadData extends Node {
  post(shared: any, prepRes: any, execRes: any): void {
    // We write data to shared store
    shared.data = 'Some text content'
    return undefined
  }
}

class Summarize extends Node {
  prep(shared: any): any {
    // We read data from shared store
    return shared.data
  }

  exec(prepRes: any): any {
    // Call LLM to summarize
    const prompt = `Summarize: ${prepRes}`
    const summary = callLLM(prompt)
    return summary
  }

  post(shared: any, prepRes: any, execRes: any): string {
    // We write summary to shared store
    shared.summary = execRes
    return 'default'
  }
}

const loadData = new LoadData()
const summarize = new Summarize()
loadData.next(summarize)
const flow = new Flow(loadData)

const shared = {}
flow.run(shared)
```

{% endtab %}
{% endtabs %}

Here:

- `LoadData` writes to `shared["data"]`.
- `Summarize` reads from `shared["data"]`, summarizes, and writes to `shared["summary"]`.

---

## 2. Params

**Params** let you store _per-Node_ or _per-Flow_ config that doesn't need to live in the shared store. They are:

- **Immutable** during a Node's run cycle (i.e., they don't change mid-`prep->exec->post`).
- **Set** via `set_params()`.
- **Cleared** and updated each time a parent Flow calls it.

{% hint style="warning" %}
Only set the uppermost Flow params because others will be overwritten by the parent Flow.

If you need to set child node params, see [Batch](./batch.md).
{% endhint %}

Typically, **Params** are identifiers (e.g., file name, page number). Use them to fetch the task you assigned or write to a specific part of the shared store.

### Example

{% tabs %}
{% tab title="Python" %}

```python
# 1) Create a Node that uses params
class SummarizeFile(Node):
    def prep(self, shared):
        # Access the node's param
        filename = self.params["filename"]
        return shared["data"].get(filename, "")

    def exec(self, prep_res):
        prompt = f"Summarize: {prep_res}"
        return call_llm(prompt)

    def post(self, shared, prep_res, exec_res):
        filename = self.params["filename"]
        shared["summary"][filename] = exec_res
        return "default"

# 2) Set params
node = SummarizeFile()

# 3) Set Node params directly (for testing)
node.set_params({"filename": "doc1.txt"})
node.run(shared)

# 4) Create Flow
flow = Flow(start=node)

# 5) Set Flow params (overwrites node params)
flow.set_params({"filename": "doc2.txt"})
flow.run(shared)  # The node summarizes doc2, not doc1
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// 1) Create a Node that uses params
class SummarizeFile extends Node {
  prep(shared: any): any {
    // Access the node's param
    const filename = this.params.filename
    return shared.data[filename] || ''
  }

  exec(prepRes: any): any {
    const prompt = `Summarize: ${prepRes}`
    return callLLM(prompt)
  }

  post(shared: any, prepRes: any, execRes: any): string {
    const filename = this.params.filename
    shared.summary[filename] = execRes
    return 'default'
  }
}

// 2) Set params
const node = new SummarizeFile()

// 3) Set Node params directly (for testing)
node.setParams({ filename: 'doc1.txt' })
node.run(shared)

// 4) Create Flow
const flow = new Flow(node)

// 5) Set Flow params (overwrites node params)
flow.setParams({ filename: 'doc2.txt' })
flow.run(shared) // The node summarizes doc2, not doc1
```

{% endtab %}
{% endtabs %}
