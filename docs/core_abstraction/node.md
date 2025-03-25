---
layout: default
title: 'Node'
parent: 'Core Abstraction'
nav_order: 1
---

# Node

A **Node** is the smallest building block. Each Node has 3 steps `prep->exec->post`:

<div align="center">
  <img src="https://github.com/the-pocket/.github/raw/main/assets/node.png?raw=true" width="400"/>
</div>

1. `prep(shared)`

   - **Read and preprocess data** from `shared` store.
   - Examples: _query DB, read files, or serialize data into a string_.
   - Return `prep_res`, which is used by `exec()` and `post()`.

2. `exec(prep_res)`

   - **Execute compute logic**, with optional retries and error handling (below).
   - Examples: _(mostly) LLM calls, remote APIs, tool use_.
   - ⚠️ This shall be only for compute and **NOT** access `shared`.
   - ⚠️ If retries enabled, ensure idempotent implementation.
   - Return `exec_res`, which is passed to `post()`.

3. `post(shared, prep_res, exec_res)`
   - **Postprocess and write data** back to `shared`.
   - Examples: _update DB, change states, log results_.
   - **Decide the next action** by returning a _string_ (`action = "default"` if _None_).

{% hint style="info" %}
**Why 3 steps?** To enforce the principle of _separation of concerns_. The data storage and data processing are operated separately.

All steps are _optional_. E.g., you can only implement `prep` and `post` if you just need to process data.
{% endhint %}

### Fault Tolerance & Retries

You can **retry** `exec()` if it raises an exception via two parameters when defining the Node:

- `max_retries` (int): Max times to run `exec()`. The default is `1` (**no** retry).
- `wait` (int): The time to wait (in **seconds**) before next retry. By default, `wait=0` (no waiting).
  `wait` is helpful when you encounter rate-limits or quota errors from your LLM provider and need to back off.

{% tabs %}
{% tab title="Python" %}

```python
my_node = SummarizeFile(max_retries=3, wait=10)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
const myNode = new SummarizeFile({ maxRetries: 3, wait: 10 })
```

When an exception occurs in `exec()`, the Node automatically retries until:

- It either succeeds, or
- The Node has retried `max_retries - 1` times already and fails on the last attempt.

You can get the current retry times (0-based) from `cur_retry`.

{% tabs %}
{% tab title="Python" %}

```python
class RetryNode(Node):
    def exec(self, prep_res):
        print(f"Retry {self.cur_retry} times")
        raise Exception("Failed")
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class RetryNode extends Node {
  exec(prepRes: any): any {
    console.log(`Retry ${this.curRetry} times`)
    throw new Error('Failed')
  }
}
```

{% endtab %}
{% endtabs %}

### Graceful Fallback

To **gracefully handle** the exception (after all retries) rather than raising it, override:

{% tabs %}
{% tab title="Python" %}

```python
def exec_fallback(self, prep_res, exc):
    raise exc
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
execFallback(prepRes: any, exc: Error): any {
  throw exc;
}
```

{% endtab %}
{% endtabs %}

By default, it just re-raises exception. But you can return a fallback result instead, which becomes the `exec_res` passed to `post()`.

### Example: Summarize file

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeFile(Node):
    def prep(self, shared):
        return shared["data"]

    def exec(self, prep_res):
        if not prep_res:
            return "Empty file content"
        prompt = f"Summarize this text in 10 words: {prep_res}"
        summary = call_llm(prompt)  # might fail
        return summary

    def exec_fallback(self, prep_res, exc):
        # Provide a simple fallback instead of crashing
        return "There was an error processing your request."

    def post(self, shared, prep_res, exec_res):
        shared["summary"] = exec_res
        # Return "default" by not returning

summarize_node = SummarizeFile(max_retries=3)

# node.run() calls prep->exec->post
# If exec() fails, it retries up to 3 times before calling exec_fallback()
action_result = summarize_node.run(shared)

print("Action returned:", action_result)  # "default"
print("Summary stored:", shared["summary"])
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeFile extends Node {
  prep(shared: any): any {
    return shared['data']
  }

  exec(prepRes: any): any {
    if (!prepRes) {
      return 'Empty file content'
    }
    const prompt = `Summarize this text in 10 words: ${prepRes}`
    const summary = callLLM(prompt) // might fail
    return summary
  }

  execFallback(prepRes: any, exc: Error): any {
    // Provide a simple fallback instead of crashing
    return 'There was an error processing your request.'
  }

  post(shared: any, prepRes: any, execRes: any): void {
    shared['summary'] = execRes
    // Return "default" by not returning
  }
}

const summarizeNode = new SummarizeFile({ maxRetries: 3 })

// node.run() calls prep->exec->post
// If exec() fails, it retries up to 3 times before calling execFallback()
const actionResult = summarizeNode.run(shared)

console.log('Action returned:', actionResult) // "default"
console.log('Summary stored:', shared['summary'])
```

{% endtab %}
{% endtabs %}
