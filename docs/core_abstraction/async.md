---
layout: default
title: "(Advanced) Async"
parent: "Core Abstraction"
nav_order: 5
---

# (Advanced) Async

**Async** Nodes implement `prep_async()`, `exec_async()`, `exec_fallback_async()`, and/or `post_async()`. This is useful for:

1. **prep_async()**: For _fetching/reading data (files, APIs, DB)_ in an I/O-friendly way.
2. **exec_async()**: Typically used for async LLM calls.
3. **post_async()**: For _awaiting user feedback_, _coordinating across multi-agents_ or any additional async steps after `exec_async()`.

**Note**: `AsyncNode` must be wrapped in `AsyncFlow`. `AsyncFlow` can also include regular (sync) nodes.

### Example

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeThenVerify(AsyncNode):
    async def prep_async(self, shared):
        # Example: read a file asynchronously
        doc_text = await read_file_async(shared["doc_path"])
        return doc_text

    async def exec_async(self, prep_res):
        # Example: async LLM call
        summary = await call_llm_async(f"Summarize: {prep_res}")
        return summary

    async def post_async(self, shared, prep_res, exec_res):
        # Example: wait for user feedback
        decision = await gather_user_feedback(exec_res)
        if decision == "approve":
            shared["summary"] = exec_res
            return "approve"
        return "deny"

summarize_node = SummarizeThenVerify()
final_node = Finalize()

# Define transitions
summarize_node - "approve" >> final_node
summarize_node - "deny"    >> summarize_node  # retry

flow = AsyncFlow(start=summarize_node)

async def main():
    shared = {"doc_path": "document.txt"}
    await flow.run_async(shared)
    print("Final Summary:", shared.get("summary"))

asyncio.run(main())
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeThenVerify extends AsyncNode {
  async prepAsync(shared: any): Promise<string> {
    // Example: read a file asynchronously
    const docText = await readFileAsync(shared['doc_path'])
    return docText
  }

  async execAsync(prepRes: string): Promise<string> {
    // Example: async LLM call
    const summary = await callLlmAsync(`Summarize: ${prepRes}`)
    return summary
  }

  async postAsync(shared: any, prepRes: string, execRes: string): Promise<string> {
    // Example: wait for user feedback
    const decision = await gatherUserFeedback(execRes)
    if (decision === 'approve') {
      shared['summary'] = execRes
      return 'approve'
    }
    return 'deny'
  }
}

const summarizeNode = new SummarizeThenVerify()
const finalNode = new Finalize()

// Define transitions
summarizeNode.minus('approve').rshift(finalNode)
summarizeNode.minus('deny').rshift(summarizeNode) // retry

const flow = new AsyncFlow(summarizeNode)

async function main() {
  const shared = { doc_path: 'document.txt' }
  await flow.runAsync(shared)
  console.log('Final Summary:', shared['summary'])
}

main().catch(console.error)
```

{% endtab %}
{% endtabs %}
