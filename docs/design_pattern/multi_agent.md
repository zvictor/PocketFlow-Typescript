---
layout: default
title: "(Advanced) Multi-Agents"
parent: "Design Pattern"
nav_order: 6
---

# (Advanced) Multi-Agents

Multiple [Agents](./flow.md) can work together by handling subtasks and communicating the progress.
Communication between agents is typically implemented using message queues in shared storage.

{% hint style="success" %}
Most of time, you don't need Multi-Agents. Start with a simple solution first.
{% endhint %}

### Example Agent Communication: Message Queue

Here's a simple example showing how to implement agent communication using `asyncio.Queue`.
The agent listens for messages, processes them, and continues listening:

{% tabs %}
{% tab title="Python" %}

```python
class AgentNode(AsyncNode):
    async def prep_async(self, _):
        message_queue = self.params["messages"]
        message = await message_queue.get()
        print(f"Agent received: {message}")
        return message

# Create node and flow
agent = AgentNode()
agent >> agent  # connect to self
flow = AsyncFlow(start=agent)

# Create heartbeat sender
async def send_system_messages(message_queue):
    counter = 0
    messages = [
        "System status: all systems operational",
        "Memory usage: normal",
        "Network connectivity: stable",
        "Processing load: optimal"
    ]

    while True:
        message = f"{messages[counter % len(messages)]} | timestamp_{counter}"
        await message_queue.put(message)
        counter += 1
        await asyncio.sleep(1)

async def main():
    message_queue = asyncio.Queue()
    shared = {}
    flow.set_params({"messages": message_queue})

    # Run both coroutines
    await asyncio.gather(
        flow.run_async(shared),
        send_system_messages(message_queue)
    )

asyncio.run(main())
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class AgentNode extends AsyncNode {
  async prepAsync(_: any) {
    const messageQueue = this.params.messages as AsyncQueue<string>
    const message = await messageQueue.get()
    console.log(`Agent received: ${message}`)
    return message
  }
}

// Create node and flow
const agent = new AgentNode()
agent.rshift(agent) // connect to self
const flow = new AsyncFlow(agent)

// Create heartbeat sender
async function sendSystemMessages(messageQueue: AsyncQueue<string>) {
  let counter = 0
  const messages = [
    'System status: all systems operational',
    'Memory usage: normal',
    'Network connectivity: stable',
    'Processing load: optimal',
  ]

  while (true) {
    const message = `${messages[counter % messages.length]} | timestamp_${counter}`
    await messageQueue.put(message)
    counter++
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
}

async function main() {
  const messageQueue = new AsyncQueue<string>()
  const shared = {}
  flow.setParams({ messages: messageQueue })

  // Run both coroutines
  await Promise.all([flow.runAsync(shared), sendSystemMessages(messageQueue)])
}

// Simple AsyncQueue implementation for TypeScript
class AsyncQueue<T> {
  private queue: T[] = []
  private waiting: ((value: T) => void)[] = []

  async get(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!
    }
    return new Promise((resolve) => {
      this.waiting.push(resolve)
    })
  }

  async put(item: T): Promise<void> {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      resolve(item)
    } else {
      this.queue.push(item)
    }
  }
}

main().catch(console.error)
```

{% endtab %}
{% endtabs %}

The output:

```
Agent received: System status: all systems operational | timestamp_0
Agent received: Memory usage: normal | timestamp_1
Agent received: Network connectivity: stable | timestamp_2
Agent received: Processing load: optimal | timestamp_3
```

### Interactive Multi-Agent Example: Taboo Game

Here's a more complex example where two agents play the word-guessing game Taboo.
One agent provides hints while avoiding forbidden words, and another agent tries to guess the target word:

{% tabs %}
{% tab title="Python" %}

```python
class AsyncHinter(AsyncNode):
    async def prep_async(self, shared):
        guess = await shared["hinter_queue"].get()
        if guess == "GAME_OVER":
            return None
        return shared["target_word"], shared["forbidden_words"], shared.get("past_guesses", [])

    async def exec_async(self, inputs):
        if inputs is None:
            return None
        target, forbidden, past_guesses = inputs
        prompt = f"Generate hint for '{target}'\nForbidden words: {forbidden}"
        if past_guesses:
            prompt += f"\nPrevious wrong guesses: {past_guesses}\nMake hint more specific."
        prompt += "\nUse at most 5 words."

        hint = call_llm(prompt)
        print(f"\nHinter: Here's your hint - {hint}")
        return hint

    async def post_async(self, shared, prep_res, exec_res):
        if exec_res is None:
            return "end"
        await shared["guesser_queue"].put(exec_res)
        return "continue"

class AsyncGuesser(AsyncNode):
    async def prep_async(self, shared):
        hint = await shared["guesser_queue"].get()
        return hint, shared.get("past_guesses", [])

    async def exec_async(self, inputs):
        hint, past_guesses = inputs
        prompt = f"Given hint: {hint}, past wrong guesses: {past_guesses}, make a new guess. Directly reply a single word:"
        guess = call_llm(prompt)
        print(f"Guesser: I guess it's - {guess}")
        return guess

    async def post_async(self, shared, prep_res, exec_res):
        if exec_res.lower() == shared["target_word"].lower():
            print("Game Over - Correct guess!")
            await shared["hinter_queue"].put("GAME_OVER")
            return "end"

        if "past_guesses" not in shared:
            shared["past_guesses"] = []
        shared["past_guesses"].append(exec_res)

        await shared["hinter_queue"].put(exec_res)
        return "continue"

async def main():
    # Set up game
    shared = {
        "target_word": "nostalgia",
        "forbidden_words": ["memory", "past", "remember", "feeling", "longing"],
        "hinter_queue": asyncio.Queue(),
        "guesser_queue": asyncio.Queue()
    }

    print("Game starting!")
    print(f"Target word: {shared['target_word']}")
    print(f"Forbidden words: {shared['forbidden_words']}")

    # Initialize by sending empty guess to hinter
    await shared["hinter_queue"].put("")

    # Create nodes and flows
    hinter = AsyncHinter()
    guesser = AsyncGuesser()

    # Set up flows
    hinter_flow = AsyncFlow(start=hinter)
    guesser_flow = AsyncFlow(start=guesser)

    # Connect nodes to themselves
    hinter - "continue" >> hinter
    guesser - "continue" >> guesser

    # Run both agents concurrently
    await asyncio.gather(
        hinter_flow.run_async(shared),
        guesser_flow.run_async(shared)
    )

asyncio.run(main())
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class AsyncHinter extends AsyncNode {
  async prepAsync(shared: any) {
    const guess = await shared.hinterQueue.get()
    if (guess === 'GAME_OVER') {
      return null
    }
    return [shared.targetWord, shared.forbiddenWords, shared.pastGuesses || []]
  }

  async execAsync(inputs: any) {
    if (inputs === null) return null
    const [target, forbidden, pastGuesses] = inputs
    let prompt = `Generate hint for '${target}'\nForbidden words: ${forbidden}`
    if (pastGuesses.length > 0) {
      prompt += `\nPrevious wrong guesses: ${pastGuesses}\nMake hint more specific.`
    }
    prompt += '\nUse at most 5 words.'

    const hint = await callLLM(prompt)
    console.log(`\nHinter: Here's your hint - ${hint}`)
    return hint
  }

  async postAsync(shared: any, prepRes: any, execRes: any) {
    if (execRes === null) return 'end'
    await shared.guesserQueue.put(execRes)
    return 'continue'
  }
}

class AsyncGuesser extends AsyncNode {
  async prepAsync(shared: any) {
    const hint = await shared.guesserQueue.get()
    return [hint, shared.pastGuesses || []]
  }

  async execAsync(inputs: any) {
    const [hint, pastGuesses] = inputs
    const prompt = `Given hint: ${hint}, past wrong guesses: ${pastGuesses}, make a new guess. Directly reply a single word:`
    const guess = await callLLM(prompt)
    console.log(`Guesser: I guess it's - ${guess}`)
    return guess
  }

  async postAsync(shared: any, prepRes: any, execRes: any) {
    if (execRes.toLowerCase() === shared.targetWord.toLowerCase()) {
      console.log('Game Over - Correct guess!')
      await shared.hinterQueue.put('GAME_OVER')
      return 'end'
    }

    if (!shared.pastGuesses) {
      shared.pastGuesses = []
    }
    shared.pastGuesses.push(execRes)

    await shared.hinterQueue.put(execRes)
    return 'continue'
  }
}

async function main() {
  // Set up game
  const shared = {
    targetWord: 'nostalgia',
    forbiddenWords: ['memory', 'past', 'remember', 'feeling', 'longing'],
    hinterQueue: new AsyncQueue<string>(),
    guesserQueue: new AsyncQueue<string>(),
  }

  console.log('Game starting!')
  console.log(`Target word: ${shared.targetWord}`)
  console.log(`Forbidden words: ${shared.forbiddenWords}`)

  // Initialize by sending empty guess to hinter
  await shared.hinterQueue.put('')

  // Create nodes and flows
  const hinter = new AsyncHinter()
  const guesser = new AsyncGuesser()

  // Set up flows
  const hinterFlow = new AsyncFlow(hinter)
  const guesserFlow = new AsyncFlow(guesser)

  // Connect nodes to themselves
  hinter.minus('continue').rshift(hinter)
  guesser.minus('continue').rshift(guesser)

  // Run both agents concurrently
  await Promise.all([hinterFlow.runAsync(shared), guesserFlow.runAsync(shared)])
}

// Mock LLM call for TypeScript
async function callLLM(prompt: string): Promise<string> {
  // In a real implementation, this would call an actual LLM API
  return 'Mock LLM response'
}

main().catch(console.error)
```

{% endtab %}
{% endtabs %}

The Output:

```
Game starting!
Target word: nostalgia
Forbidden words: ['memory', 'past', 'remember', 'feeling', 'longing']

Hinter: Here's your hint - Thinking of childhood summer days
Guesser: I guess it's - popsicle

Hinter: Here's your hint - When childhood cartoons make you emotional
Guesser: I guess it's - nostalgic

Hinter: Here's your hint - When old songs move you
Guesser: I guess it's - memories

Hinter: Here's your hint - That warm emotion about childhood
Guesser: I guess it's - nostalgia
Game Over - Correct guess!
```
