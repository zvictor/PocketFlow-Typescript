---
layout: default
title: 'Agentic Coding'
---

# Agentic Coding: Humans Design, Agents code!

{% hint style="warning" %}
If you are an AI agents involved in building LLM Systems, read this guide **VERY, VERY** carefully! This is the most important chapter in the entire document. Throughout development, you should always (1) start with a small and simple solution, (2) design at a high level (`docs/design.md`) before implementation, and (3) frequently ask humans for feedback and clarification.
{% endhint %}

## Agentic Coding Steps

Agentic Coding should be a collaboration between Human System Design and Agent Implementation:

| Steps             |   Human    |     AI     | Comment                                                                                        |
| :---------------- | :--------: | :--------: | :--------------------------------------------------------------------------------------------- |
| 1. Requirements   |  ★★★ High  |  ★☆☆ Low   | Humans understand the requirements and context.                                                |
| 2. Flow           | ★★☆ Medium | ★★☆ Medium | Humans specify the high-level design, and the AI fills in the details.                         |
| 3. Utilities      | ★★☆ Medium | ★★☆ Medium | Humans provide available external APIs and integrations, and the AI helps with implementation. |
| 4. Node           |  ★☆☆ Low   |  ★★★ High  | The AI helps design the node types and data handling based on the flow.                        |
| 5. Implementation |  ★☆☆ Low   |  ★★★ High  | The AI implements the flow based on the design.                                                |
| 6. Optimization   | ★★☆ Medium | ★★☆ Medium | Humans evaluate the results, and the AI helps optimize.                                        |
| 7. Reliability    |  ★☆☆ Low   |  ★★★ High  | The AI writes test cases and addresses corner cases.                                           |

1. **Requirements**: Clarify the requirements for your project, and evaluate whether an AI system is a good fit.

   - Understand AI systems' strengths and limitations:
     - **Good for**: Routine tasks requiring common sense (filling forms, replying to emails)
     - **Good for**: Creative tasks with well-defined inputs (building slides, writing SQL)
     - **Not good for**: Ambiguous problems requiring complex decision-making (business strategy, startup planning)
   - **Keep It User-Centric:** Explain the "problem" from the user's perspective rather than just listing features.
   - **Balance complexity vs. impact**: Aim to deliver the highest value features with minimal complexity early.

2. **Flow Design**: Outline at a high level, describe how your AI system orchestrates nodes.

   {% hint style="warning" %}
   **If Humans can't specify the flow, AI Agents can't automate it!** Before building an LLM system, thoroughly understand the problem and potential solution by manually solving example inputs to develop intuition.  
   {% endhint %}

   - Identify applicable design patterns (e.g., [Map Reduce](./design_pattern/mapreduce.md), [Agent](./design_pattern/agent.md), [RAG](./design_pattern/rag.md)).
     - For each node in the flow, start with a high-level one-line description of what it does.
     - If using **Map Reduce**, specify how to map (what to split) and how to reduce (how to combine).
     - If using **Agent**, specify what are the inputs (context) and what are the possible actions.
     - If using **RAG**, specify what to embed, noting that there's usually both offline (indexing) and online (retrieval) workflows.
   - Outline the flow and draw it in a mermaid diagram. For example:

     ```mermaid
     flowchart LR
         start[Start] --> batch[Batch]
         batch --> check[Check]
         check -->|OK| process
         check -->|Error| fix[Fix]
         fix --> check

         subgraph process[Process]
           step1[Step 1] --> step2[Step 2]
         end

         process --> endNode[End]
     ```

3. **Utilities**: Based on the Flow Design, identify and implement necessary utility functions.
   {% hint style="success" %}
   **Sometimes, design Utilies before Flow:** For example, for an LLM project to automate a legacy system, the bottleneck will likely be the available interface to that system. Start by designing the hardest utilities for interfacing, and then build the flow around them.
   {% endhint %}

   - Think of your AI system as the brain. It needs a body—these _external utility functions_—to interact with the real world:
       <div align="center"><img src="https://github.com/the-pocket/.github/raw/main/assets/utility.png?raw=true" width="400"/></div>

     - Reading inputs (e.g., retrieving Slack messages, reading emails)
     - Writing outputs (e.g., generating reports, sending emails)
     - Using external tools (e.g., calling LLMs, searching the web)
     - **NOTE**: _LLM-based tasks_ (e.g., summarizing text, analyzing sentiment) are **NOT** utility functions; rather, they are _core functions_ internal in the AI system.

   - For each utility function, implement it and write a simple test.
   - Document their input/output, as well as why they are necessary. For example:
     - `name`: `get_embedding` (`utils/get_embedding.py`)
     - `input`: `str`
     - `output`: a vector of 3072 floats
     - `necessity`: Used by the second node to embed text
   - Example utility implementation:

{% tabs %}
{% tab title="Python" %}

```python
# utils/call_llm.py
from openai import OpenAI

def call_llm(prompt):
    client = OpenAI(api_key="YOUR_API_KEY_HERE")
    r = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content

if __name__ == "__main__":
    prompt = "What is the meaning of life?"
    print(call_llm(prompt))
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// utils/callLLM.ts
import OpenAI from 'openai'

export async function callLLM(prompt: string): Promise<string> {
  const openai = new OpenAI({
    apiKey: 'YOUR_API_KEY_HERE',
  })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
  })

  return response.choices[0]?.message?.content || ''
}

// Example usage
;(async () => {
  const prompt = 'What is the meaning of life?'
  console.log(await callLLM(prompt))
})()
```

{% endtab %}
{% endtabs %}

4. **Node Design**: Plan how each node will read and write data, and use utility functions.

   - One core design principle for PocketFlow is to use a [shared store](./core_abstraction/communication.md), so start with a shared store design:
     - For simple systems, use an in-memory dictionary.
     - For more complex systems or when persistence is required, use a database.
     - **Don't Repeat Yourself**: Use in-memory references or foreign keys.
     - Example shared store design:
       ```python
       shared = {
           "user": {
               "id": "user123",
               "context": {                # Another nested dict
                   "weather": {"temp": 72, "condition": "sunny"},
                   "location": "San Francisco"
               }
           },
           "results": {}                   # Empty dict to store outputs
       }
       ```
   - For each [Node](./core_abstraction/node.md), describe how it reads and writes data, and which utility function it uses. Keep it specific but high-level without codes. For example:
     - `prep`: Read "text" from the shared store
     - `exec`: Call the embedding utility function
     - `post`: Write "embedding" to the shared store
     - For batch processing, specify if it's sequential or parallel

5. **Implementation**: Implement the initial nodes and flows based on the design.

   - 🎉 If you've reached this step, humans have finished the design. Now _Agentic Coding_ begins!
   - **"Keep it simple, stupid!"** Avoid complex features and full-scale type checking.
   - **FAIL FAST**! Avoid `try` logic so you can quickly identify any weak points in the system.
   - Add logging throughout the code to facilitate debugging.

6. **Optimization**:

   - **Use Intuition**: For a quick initial evaluation, human intuition is often a good start.
   - **Redesign Flow (Back to Step 3)**: Consider breaking down tasks further, introducing agentic decisions, or better managing input contexts.
   - If your flow design is already solid, move on to micro-optimizations:

     - **Prompt Engineering**: Use clear, specific instructions with examples to reduce ambiguity.
     - **In-Context Learning**: Provide robust examples for tasks that are difficult to specify with instructions alone.

{% hint style="success" %}
**You'll likely iterate a lot!** Expect to repeat Steps 3–6 hundreds of times.

<div align="center"><img src="https://github.com/the-pocket/.github/raw/main/assets/success.png?raw=true" width="400"/></div>
{% endhint %}

7. **Reliability**
   - **Node Retries**: Add checks in the node `exec` to ensure outputs meet requirements, and consider increasing `max_retries` and `wait` times.
   - **Logging and Visualization**: Maintain logs of all attempts and visualize node results for easier debugging.
   - **Self-Evaluation**: Add a separate node (powered by an LLM) to review outputs when results are uncertain.

## Example LLM Project File Structure

```
my_project/
├── main.py
├── nodes.py
├── flow.py
├── utils/
│   ├── __init__.py
│   ├── call_llm.py
│   └── search_web.py
├── requirements.txt
└── docs/
    └── design.md
```

- **`docs/design.md`**: Contains project documentation for each step above. This should be _high-level_ and _no-code_.
- **`utils/`**: Contains all utility functions.
  - It's recommended to dedicate one Python file to each API call, for example `call_llm.py` or `search_web.py`.
  - Each file should also include a `main()` function to try that API call
- **`nodes.py`**: Contains all the node definitions.

{% tabs %}
{% tab title="Python" %}

```python
# nodes.py
from pocketflow import Node
from utils.call_llm import call_llm

class GetQuestionNode(Node):
    async def exec(self, _):
        # Get question directly from user input
        user_question = input("Enter your question: ")
        return user_question

    async def post(self, shared, prep_res, exec_res):
        # Store the user's question
        shared["question"] = exec_res
        return "default"  # Go to the next node

class AnswerNode(Node):
    async def prep(self, shared):
        # Read question from shared
        return shared["question"]

    async def exec(self, question):
        # Call LLM to get the answer
        return call_llm(question)

    async def post(self, shared, prep_res, exec_res):
        # Store the answer in shared
        shared["answer"] = exec_res
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// nodes.ts
import { Node } from 'pocketflow'
import { callLLM } from './utils/callLLM'

class GetQuestionNode extends Node {
  async exec(_: any): Promise<string> {
    // Get question directly from user input
    const userQuestion = 'What is the meaning of life?'
    return userQuestion
  }

  async post(shared: any, _prepRes: any, execRes: string): Promise<string> {
    // Store the user's question
    shared['question'] = execRes
    return 'default' // Go to the next node
  }
}

class AnswerNode extends Node {
  async prep(shared: any): Promise<string> {
    // Read question from shared
    return shared['question']
  }

  async exec(question: string): Promise<string> {
    // Call LLM to get the answer
    return await callLLM(question)
  }

  async post(shared: any, _prepRes: any, execRes: string): Promise<void> {
    // Store the answer in shared
    shared['answer'] = execRes
  }
}
```

{% endtab %}
{% endtabs %}

- **`flow.py`**: Implements functions that create flows by importing node definitions and connecting them.

{% tabs %}
{% tab title="Python" %}

```python
# flow.py
from pocketflow import Flow
from nodes import GetQuestionNode, AnswerNode

def create_qa_flow():
    """Create and return a question-answering flow."""
    # Create nodes
    get_question_node = GetQuestionNode()
    answer_node = AnswerNode()

    # Connect nodes in sequence
    get_question_node >> answer_node

    # Create flow starting with input node
    return Flow(start=get_question_node)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// flow.ts
import { Flow } from 'pocketflow'
import { AnswerNode, GetQuestionNode } from './nodes'

export function createQaFlow(): Flow {
  // Create nodes
  const getQuestionNode = new GetQuestionNode()
  const answerNode = new AnswerNode()

  // Connect nodes in sequence
  getQuestionNode.next(answerNode)

  // Create flow starting with input node
  return new Flow(getQuestionNode)
}
```

{% endtab %}
{% endtabs %}

- **`main.py`**: Serves as the project's entry point.

{% tabs %}
{% tab title="Python" %}

```python
# main.py
from flow import create_qa_flow

# Example main function
# Please replace this with your own main function
async def main():
    shared = {
        "question": None,  # Will be populated by GetQuestionNode from user input
        "answer": None     # Will be populated by AnswerNode
    }

    # Create the flow and run it
    qa_flow = create_qa_flow()
    await qa_flow.run(shared)
    print(f"Question: {shared['question']}")
    print(f"Answer: {shared['answer']}")

if __name__ == "__main__":
    asyncio.run(main())
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// main.ts
import { createQaFlow } from './flow'

// Example main function
async function main() {
  const shared = {
    question: null as string | null, // Will be populated by GetQuestionNode
    answer: null as string | null, // Will be populated by AnswerNode
  }

  // Create the flow and run it
  const qaFlow = createQaFlow()
  await qaFlow.run(shared)
  console.log(`Question: ${shared.question}`)
  console.log(`Answer: ${shared.answer}`)
}

main().catch(console.error)
```

{% endtab %}
{% endtabs %}
