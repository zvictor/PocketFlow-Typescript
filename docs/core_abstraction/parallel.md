---
layout: default
title: "(Advanced) Parallel"
parent: "Core Abstraction"
nav_order: 6
---

# (Advanced) Parallel

**Parallel** Nodes and Flows let you run multiple **Async** Nodes and Flows **concurrently**—for example, summarizing multiple texts at once. This can improve performance by overlapping I/O and compute.

{% hint style="warning" %}
Because of Python’s GIL, parallel nodes and flows can’t truly parallelize CPU-bound tasks (e.g., heavy numerical computations). However, they excel at overlapping I/O-bound work—like LLM calls, database queries, API requests, or file I/O.
{% endhint %}

{% hint style="success" %}

- **Ensure Tasks Are Independent**: If each item depends on the output of a previous item, **do not** parallelize.
- **Beware of Rate Limits**: Parallel calls can **quickly** trigger rate limits on LLM services. You may need a **throttling** mechanism (e.g., semaphores or sleep intervals).
- **Consider Single-Node Batch APIs**: Some LLMs offer a **batch inference** API where you can send multiple prompts in a single call. This is more complex to implement but can be more efficient than launching many parallel requests and mitigates rate limits.
  {% endhint %}

## AsyncParallelBatchNode

Like **AsyncBatchNode**, but run `exec_async()` in **parallel**:

{% tabs %}
{% tab title="Python" %}

```python
class ParallelSummaries(AsyncParallelBatchNode):
    async def prep_async(self, shared):
        # e.g., multiple texts
        return shared["texts"]

    async def exec_async(self, text):
        prompt = f"Summarize: {text}"
        return await call_llm_async(prompt)

    async def post_async(self, shared, prep_res, exec_res_list):
        shared["summary"] = "\n\n".join(exec_res_list)
        return "default"

node = ParallelSummaries()
flow = AsyncFlow(start=node)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class ParallelSummaries extends AsyncParallelBatchNode {
  async prepAsync(shared: any): Promise<any[]> {
    return shared.texts
  }

  async execAsync(text: string): Promise<string> {
    const prompt = `Summarize: ${text}`
    return await callLlmAsync(prompt)
  }

  async postAsync(shared: any, prepRes: any, execResList: string[]): Promise<string> {
    shared.summary = execResList.join('\n\n')
    return 'default'
  }
}

const node = new ParallelSummaries()
const flow = new AsyncFlow(node)
```

{% endtab %}
{% endtabs %}

## AsyncParallelBatchFlow

Parallel version of **BatchFlow**. Each iteration of the sub-flow runs **concurrently** using different parameters:

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeMultipleFiles(AsyncParallelBatchFlow):
    async def prep_async(self, shared):
        return [{"filename": f} for f in shared["files"]]

sub_flow = AsyncFlow(start=LoadAndSummarizeFile())
parallel_flow = SummarizeMultipleFiles(start=sub_flow)
await parallel_flow.run_async(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeMultipleFiles extends AsyncParallelBatchFlow {
  async prepAsync(shared: any): Promise<any[]> {
    return shared.files.map((f: string) => ({ filename: f }))
  }
}

const subFlow = new AsyncFlow(new LoadAndSummarizeFile())
const parallelFlow = new SummarizeMultipleFiles(subFlow)
await parallelFlow.runAsync(shared)
```

{% endtab %}
{% endtabs %}
