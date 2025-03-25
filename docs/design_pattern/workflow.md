---
layout: default
title: 'Workflow'
parent: 'Design Pattern'
nav_order: 2
---

# Workflow

Many real-world tasks are too complex for one LLM call. The solution is to **Task Decomposition**: decompose them into a [chain](../core_abstraction/flow.md) of multiple Nodes.

<div align="center">
  <img src="https://github.com/the-pocket/.github/raw/main/assets/workflow.png?raw=true" width="400"/>
</div>

{% hint style="success" %}
You don't want to make each task **too coarse**, because it may be _too complex for one LLM call_.
You don't want to make each task **too granular**, because then _the LLM call doesn't have enough context_ and results are _not consistent across nodes_.

You usually need multiple _iterations_ to find the _sweet spot_. If the task has too many _edge cases_, consider using [Agents](./agent.md).
{% endhint %}

### Example: Article Writing

{% tabs %}
{% tab title="Python" %}

```python
class GenerateOutline(Node):
    def prep(self, shared): return shared["topic"]
    def exec(self, topic): return call_llm(f"Create a detailed outline for an article about {topic}")
    def post(self, shared, prep_res, exec_res): shared["outline"] = exec_res

class WriteSection(Node):
    def prep(self, shared): return shared["outline"]
    def exec(self, outline): return call_llm(f"Write content based on this outline: {outline}")
    def post(self, shared, prep_res, exec_res): shared["draft"] = exec_res

class ReviewAndRefine(Node):
    def prep(self, shared): return shared["draft"]
    def exec(self, draft): return call_llm(f"Review and improve this draft: {draft}")
    def post(self, shared, prep_res, exec_res): shared["final_article"] = exec_res

# Connect nodes
outline = GenerateOutline()
write = WriteSection()
review = ReviewAndRefine()

outline >> write >> review

# Create and run flow
writing_flow = Flow(start=outline)
shared = {"topic": "AI Safety"}
writing_flow.run(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class GenerateOutline extends Node {
  prep(shared: any): any {
    return shared['topic']
  }
  exec(topic: string): any {
    return callLLM(`Create a detailed outline for an article about ${topic}`)
  }
  post(shared: any, prepRes: any, execRes: any): void {
    shared['outline'] = execRes
  }
}

class WriteSection extends Node {
  prep(shared: any): any {
    return shared['outline']
  }
  exec(outline: string): any {
    return callLLM(`Write content based on this outline: ${outline}`)
  }
  post(shared: any, prepRes: any, execRes: any): void {
    shared['draft'] = execRes
  }
}

class ReviewAndRefine extends Node {
  prep(shared: any): any {
    return shared['draft']
  }
  exec(draft: string): any {
    return callLLM(`Review and improve this draft: ${draft}`)
  }
  post(shared: any, prepRes: any, execRes: any): void {
    shared['final_article'] = execRes
  }
}

// Connect nodes
const outline = new GenerateOutline()
const write = new WriteSection()
const review = new ReviewAndRefine()

outline.rshift(write).rshift(review)

// Create and run flow
const writingFlow = new Flow(outline)
const shared = { topic: 'AI Safety' }
writingFlow.run(shared)
```

{% endtab %}
{% endtabs %}

For _dynamic cases_, consider using [Agents](./agent.md).
