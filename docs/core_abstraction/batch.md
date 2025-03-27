---
layout: default
title: 'Batch'
parent: 'Core Abstraction'
nav_order: 4
---

# Batch

**Batch** makes it easier to handle large inputs in one Node or **rerun** a Flow multiple times. Example use cases:

- **Chunk-based** processing (e.g., splitting large texts).
- **Iterative** processing over lists of input items (e.g., user queries, files, URLs).

## 1. SequentialBatchNode

A **SequentialBatchNode** extends `Node` for sequential processing with changes to:

- **`async prep(shared)`**: returns an **iterable** (e.g., list, generator).
- **`async exec(item)`**: called **once** per item in that iterable.
- **`async post(shared, prep_res, exec_res_list)`**: after all items are processed, receives a **list** of results (`exec_res_list`) and returns an **Action**.

## 2. ParallelBatchNode

{% hint style="warning" %}
**Parallel Processing Considerations**:

- Ensure operations are independent before parallelizing
- Watch for race conditions in shared resources
- Consider using [Throttling](./throttling.md) mechanisms for rate-limited APIs
  {% endhint %}

A **ParallelBatchNode** extends `Node` for parallel processing with changes to:

- **`async prep(shared)`**: returns an **iterable** (e.g., list, generator).
- **`async exec(item)`**: called **concurrently** for each item.
- **`async post(shared, prep_res, exec_res_list)`**: receives all results when done.

### Example: Sequential Summarize File

{% tabs %}
{% tab title="Python" %}
{% hint style="info" %}
**Python GIL Note**: Due to Python's GIL, parallel nodes can't truly parallelize CPU-bound tasks but excel at I/O-bound work like API calls.
{% endhint %}

```python
class SequentialSummaries(SequentialBatchNode):
    async def prep(self, shared):
    	# Suppose we have a big file; chunk it
        content = shared["data"]
        chunk_size = 10000
        return [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]

    async def exec(self, chunk):
        prompt = f"Summarize this chunk in 10 words: {chunk}"
        return await call_llm_async(prompt)

    async def post(self, shared, prep_res, exec_res_list):
        shared["summary"] = "\n".join(exec_res_list)
        return "default"
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SequentialSummaries extends SequentialBatchNode {
  async prep(shared: any): Promise<string[]> {
    // Suppose we have a big file; chunk it
    const content = shared['data']
    const chunkSize = 10000
    const chunks: string[] = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize))
    }
    return chunks
  }

  async exec(chunk: string): Promise<string> {
    const prompt = `Summarize this chunk in 10 words: ${chunk}`
    return await callLLM(prompt)
  }

  async post(shared: any, prepRes: string[], execResList: string[]): Promise<string> {
    shared['summary'] = execResList.join('\n')
    return 'default'
  }
}
```

{% endtab %}
{% endtabs %}

### Example: Parallel Summarize of a Large File

{% tabs %}
{% tab title="Python" %}

```python
class ParallelSummaries(ParallelBatchNode):
    async def prep(self, shared):
        # Suppose we have a big file; chunk it
        content = shared["data"]
        chunk_size = 10000
        chunks = [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]
        return chunks

    async def exec(self, chunk):
        prompt = f"Summarize this chunk in 10 words: {chunk}"
        summary = call_llm(prompt)
        return summary

    async def post(self, shared, prep_res, exec_res_list):
        shared["summary"] = "\n".join(exec_res_list)
        return "default"

# (Optional) With concurrency control
class LimitedParallelSummaries(ParallelSummaries):
    def __init__(self, concurrency=3):
        self.semaphore = asyncio.Semaphore(concurrency)

    async def exec(self, chunk):
        async with self.semaphore:
            prompt = f"Summarize this chunk in 10 words: {chunk}"
            return call_llm(prompt)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class ParallelSummaries extends ParallelBatchNode {
  async prep(shared: any): Promise<string[]> {
    // Suppose we have a big file; chunk it
    const content = shared['data']
    const chunkSize = 10000
    const chunks: string[] = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize))
    }
    return chunks
  }

  async exec(chunk: string): Promise<string> {
    const prompt = `Summarize this chunk in 10 words: ${chunk}`
    return await callLLM(prompt)
  }

  async post(shared: any, prepRes: string[], execResList: string[]): Promise<string> {
    shared['summary'] = execResList.join('\n')
    return 'default'
  }
}

class LimitedParallelSummaries extends ParallelBatchNode {
  private limit: ReturnType<typeof pLimit>

  constructor(concurrency = 3) {
    super()
    this.limit = pLimit(concurrency)
  }

  async exec(chunk: string): Promise<string> {
    return this.limit(() => {
      const prompt = `Summarize this chunk in 10 words: ${chunk}`
      return callLLM(prompt)
    })
  }
}
```

{% endtab %}
{% endtabs %}

---

## 3. BatchFlow Types

### SequentialBatchFlow

A **SequentialBatchFlow** runs a **Flow** multiple times sequentially, each time with different `params`. Think of it as a loop that replays the Flow for each parameter set.

{% hint style="info" %}
**When to use**: Choose sequential processing when order matters or when working with APIs that have strict rate limits. See [Throttling](./throttling.md) for managing rate limits.
{% endhint %}

### ParallelBatchFlow

A **ParallelBatchFlow** runs a **Flow** multiple times concurrently, each time with different `params`. This is useful for I/O-bound operations where you want to maximize throughput.

{% hint style="warning" %}
**Concurrency Considerations**:

- Ensure operations are independent
- Watch for race conditions in shared resources
- Consider using [Throttling](./throttling.md) mechanisms for rate-limited APIs
  {% endhint %}

### Example: Summarize Many Files

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeAllFiles(SequentialBatchFlow): # or use ParallelBatchFlow
    def prep(self, shared):
        # Return a list of param dicts (one per file)
        filenames = list(shared["data"].keys())  # e.g., ["file1.txt", "file2.txt", ...]
        return [{"filename": fn} for fn in filenames]

# Suppose we have a per-file Flow (e.g., load_file >> summarize >> reduce):
summarize_file = SummarizeFile(start=load_file)

# Wrap that flow into a SequentialBatchFlow:
summarize_all_files = SummarizeAllFiles(start=summarize_file)
summarize_all_files.run(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeAllFiles extends SequentialBatchFlow /* or use ParallelBatchFlow */ {
  prep(shared: any): Array<Record<string, string>> {
    // Return a list of param dicts (one per file)
    const filenames = Object.keys(shared['data']) // e.g., ["file1.txt", "file2.txt", ...]
    return filenames.map((fn) => ({ filename: fn }))
  }
}

// Suppose we have a per-file Flow (e.g., load_file >> summarize >> reduce):
const summarizeFile = new SummarizeFile(loadFile)

// Wrap that flow into a SequentialBatchFlow:
const summarizeAllFiles = new SummarizeAllFiles(summarizeFile)
summarizeAllFiles.run(shared)
```

{% endtab %}
{% endtabs %}

### Under the Hood

1. `prep(shared)` returns a list of param dicts—e.g., `[{filename: "file1.txt"}, {filename: "file2.txt"}, ...]`.
2. The **BatchFlow** loops through each dict. For each one:
   - It merges the dict with the BatchFlow’s own `params`.
   - It calls `flow.run(shared)` using the merged result.
3. This means the sub-Flow is run **repeatedly**, once for every param dict.

---

## 5. Nested or Multi-Level Batches

You can nest a **SequentialBatchFlow** or **ParallelBatchFlow** in another batch flow. For instance:

- **Outer** batch: returns a list of diretory param dicts (e.g., `{"directory": "/pathA"}`, `{"directory": "/pathB"}`, ...).
- **Inner** batch: returning a list of per-file param dicts.

At each level, **BatchFlow** merges its own param dict with the parent’s. By the time you reach the **innermost** node, the final `params` is the merged result of **all** parents in the chain. This way, a nested structure can keep track of the entire context (e.g., directory + file name) at once.

{% tabs %}
{% tab title="Python" %}

```python
class FileBatchFlow(SequentialBatchFlow):
    def prep(self, shared):
        directory = self.params["directory"]
        # e.g., files = ["file1.txt", "file2.txt", ...]
        files = [f for f in os.listdir(directory) if f.endswith(".txt")]
        return [{"filename": f} for f in files]

class DirectoryBatchFlow(SequentialBatchFlow):
    def prep(self, shared):
        directories = [ "/path/to/dirA", "/path/to/dirB"]
        return [{"directory": d} for d in directories]

# MapSummaries have params like {"directory": "/path/to/dirA", "filename": "file1.txt"}
inner_flow = FileBatchFlow(start=MapSummaries())
outer_flow = DirectoryBatchFlow(start=inner_flow)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class FileBatchFlow extends SequentialBatchFlow {
  prep(shared: any): Array<Record<string, string>> {
    const directory = this.params['directory']
    // In real code you would use fs.readdirSync() or similar
    // For example purposes we'll mock some files
    const files = ['file1.txt', 'file2.txt'].filter((f) => f.endsWith('.txt'))
    return files.map((f) => ({ filename: f }))
  }
}

class DirectoryBatchFlow extends SequentialBatchFlow {
  prep(shared: any): Array<Record<string, string>> {
    const directories = ['/path/to/dirA', '/path/to/dirB']
    return directories.map((d) => ({ directory: d }))
  }
}

// MapSummaries have params like {"directory": "/path/to/dirA", "filename": "file1.txt"}
const innerFlow = new FileBatchFlow(new MapSummaries())
const outerFlow = new DirectoryBatchFlow(innerFlow)
```

{% endtab %}
{% endtabs %}
