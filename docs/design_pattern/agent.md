---
layout: default
title: 'Agent'
parent: 'Design Pattern'
nav_order: 1
---

# Agent

Agent is a powerful design pattern in which nodes can take dynamic actions based on the context.

<div align="center">
  <img src="https://github.com/the-pocket/.github/raw/main/assets/agent.png?raw=true" width="350"/>
</div>

## Implement Agent with Graph

1. **Context and Action:** Implement nodes that supply context and perform actions.
2. **Branching:** Use branching to connect each action node to an agent node. Use action to allow the agent to direct the [flow](../core_abstraction/flow.md) between nodes—and potentially loop back for multi-step.
3. **Agent Node:** Provide a prompt to decide action—for example:

{% tabs %}
{% tab title="Python" %}

````python
f"""
### CONTEXT
Task: {task_description}
Previous Actions: {previous_actions}
Current State: {current_state}

### ACTION SPACE
[1] search
  Description: Use web search to get results
  Parameters:
    - query (str): What to search for

[2] answer
  Description: Conclude based on the results
  Parameters:
    - result (str): Final answer to provide

### NEXT ACTION
Decide the next action based on the current context and available action space.
Return your response in the following format:

```yaml
thinking: |
    <your step-by-step reasoning process>
action: <action_name>
parameters:
    <parameter_name>: <parameter_value>
```"""
````

{% endtab %}

{% tab title="TypeScript" %}

```typescript
;`### CONTEXT
Task: ${taskDescription}
Previous Actions: ${previousActions}
Current State: ${currentState}

### ACTION SPACE
[1] search
  Description: Use web search to get results
  Parameters:
    - query (string): What to search for

[2] answer
  Description: Conclude based on the results  
  Parameters:
    - result (string): Final answer to provide

### NEXT ACTION
Decide the next action based on the current context and available action space.
Return your response in the following format:

\`\`\`yaml
thinking: |
    <your step-by-step reasoning process>
action: <action_name>
parameters:
    <parameter_name>: <parameter_value>
\`\`\``
```

{% endtab %}
{% endtabs %}

The core of building **high-performance** and **reliable** agents boils down to:

1. **Context Management:** Provide _relevant, minimal context._ For example, rather than including an entire chat history, retrieve the most relevant via [RAG](./rag.md). Even with larger context windows, LLMs still fall victim to ["lost in the middle"](https://arxiv.org/abs/2307.03172), overlooking mid-prompt content.

2. **Action Space:** Provide _a well-structured and unambiguous_ set of actions—avoiding overlap like separate `read_databases` or `read_csvs`. Instead, import CSVs into the database.

## Example Good Action Design

- **Incremental:** Feed content in manageable chunks (500 lines or 1 page) instead of all at once.

- **Overview-zoom-in:** First provide high-level structure (table of contents, summary), then allow drilling into details (raw texts).

- **Parameterized/Programmable:** Instead of fixed actions, enable parameterized (columns to select) or programmable (SQL queries) actions, for example, to read CSV files.

- **Backtracking:** Let the agent undo the last step instead of restarting entirely, preserving progress when encountering errors or dead ends.

## Example: Search Agent

This agent:

1. Decides whether to search or answer
2. If searches, loops back to decide if more search needed
3. Answers when enough context gathered

{% tabs %}
{% tab title="Python" %}

````python
class DecideAction(Node):
    def prep(self, shared):
        context = shared.get("context", "No previous search")
        query = shared["query"]
        return query, context

    def exec(self, inputs):
        query, context = inputs
        prompt = f"""
Given input: {query}
Previous search results: {context}
Should I: 1) Search web for more info 2) Answer with current knowledge
Output in yaml:
```yaml
action: search/answer
reason: why this action
search_term: search phrase if action is search
```"""
        resp = call_llm(prompt)
        yaml_str = resp.split("```yaml")[1].split("```")[0].strip()
        result = yaml.safe_load(yaml_str)

        assert isinstance(result, dict)
        assert "action" in result
        assert "reason" in result
        assert result["action"] in ["search", "answer"]
        if result["action"] == "search":
            assert "search_term" in result

        return result

    def post(self, shared, prep_res, exec_res):
        if exec_res["action"] == "search":
            shared["search_term"] = exec_res["search_term"]
        return exec_res["action"]
````

{% endtab %}

{% tab title="TypeScript" %}

````typescript
class DecideAction extends Node {
  prep(shared: any): [string, string] {
    const context = shared.context || 'No previous search'
    const query = shared.query
    return [query, context]
  }

  exec(inputs: [string, string]): any {
    const [query, context] = inputs
    const prompt = `
Given input: ${query}
Previous search results: ${context}
Should I: 1) Search web for more info 2) Answer with current knowledge
Output in yaml:
\`\`\`yaml
action: search/answer
reason: why this action  
search_term: search phrase if action is search
\`\`\``

    const resp = callLLM(prompt)
    const yamlStr = resp.split('```yaml')[1].split('```')[0].trim()
    const result = parseYaml(yamlStr)

    if (typeof result !== 'object' || !result) {
      throw new Error('Invalid YAML response')
    }
    if (!('action' in result)) {
      throw new Error('Missing action in response')
    }
    if (!('reason' in result)) {
      throw new Error('Missing reason in response')
    }
    if (!['search', 'answer'].includes(result.action)) {
      throw new Error('Invalid action value')
    }
    if (result.action === 'search' && !('search_term' in result)) {
      throw new Error('Missing search_term for search action')
    }

    return result
  }

  post(shared: any, prepRes: any, execRes: any): string {
    if (execRes.action === 'search') {
      shared.search_term = execRes.search_term
    }
    return execRes.action
  }
}
````

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class SearchWeb(Node):
    def prep(self, shared):
        return shared["search_term"]

    def exec(self, search_term):
        return search_web(search_term)

    def post(self, shared, prep_res, exec_res):
        prev_searches = shared.get("context", [])
        shared["context"] = prev_searches + [
            {"term": shared["search_term"], "result": exec_res}
        ]
        return "decide"
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SearchWeb extends Node {
  prep(shared: any): string {
    return shared.search_term
  }

  exec(searchTerm: string): any {
    return searchWeb(searchTerm)
  }

  post(shared: any, prepRes: any, execRes: any): string {
    const prevSearches = shared.context || []
    shared.context = [...prevSearches, { term: shared.search_term, result: execRes }]
    return 'decide'
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class DirectAnswer(Node):
    def prep(self, shared):
        return shared["query"], shared.get("context", "")

    def exec(self, inputs):
        query, context = inputs
        return call_llm(f"Context: {context}\nAnswer: {query}")

    def post(self, shared, prep_res, exec_res):
       print(f"Answer: {exec_res}")
       shared["answer"] = exec_res
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class DirectAnswer extends Node {
  prep(shared: any): [string, string] {
    return [shared.query, shared.context || '']
  }

  exec(inputs: [string, string]): string {
    const [query, context] = inputs
    return callLLM(`Context: ${context}\nAnswer: ${query}`)
  }

  post(shared: any, prepRes: any, execRes: string): void {
    console.log(`Answer: ${execRes}`)
    shared.answer = execRes
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
# Connect nodes
decide = DecideAction()
search = SearchWeb()
answer = DirectAnswer()

decide - "search" >> search
decide - "answer" >> answer
search - "decide" >> decide # Loop back

flow = Flow(start=decide)
flow.run({"query": "Who won the Nobel Prize in Physics 2024?"})
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// Connect nodes
const decide = new DecideAction()
const search = new SearchWeb()
const answer = new DirectAnswer()

// Using operator overloading equivalents
decide.minus('search').rshift(search)
decide.minus('answer').rshift(answer)
search.minus('decide').rshift(decide) // Loop back

const flow = new Flow(decide)
flow.run({ query: 'Who won the Nobel Prize in Physics 2024?' })
```

{% endtab %}
{% endtabs %}
