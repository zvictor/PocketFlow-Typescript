---
layout: default
title: "Batch"
parent: "Core Abstraction"
nav_order: 4
---

# Batch

**Batch** makes it easier to handle large inputs in one Node or **rerun** a Flow multiple times. Example use cases:

- **Chunk-based** processing (e.g., splitting large texts).
- **Iterative** processing over lists of input items (e.g., user queries, files, URLs).

## 1. BatchNode

A **BatchNode** extends `Node` but changes `prep()` and `exec()`:

- **`prep(shared)`**: returns an **iterable** (e.g., list, generator).
- **`exec(item)`**: called **once** per item in that iterable.
- **`post(shared, prep_res, exec_res_list)`**: after all items are processed, receives a **list** of results (`exec_res_list`) and returns an **Action**.

### Example: Summarize a Large File

{% tabs %}
{% tab title="Python" %}

```python
class MapSummaries(BatchNode):
    def prep(self, shared):
        # Suppose we have a big file; chunk it
        content = shared["data"]
        chunk_size = 10000
        chunks = [content[i:i+chunk_size] for i in range(0, len(content), chunk_size)]
        return chunks

    def exec(self, chunk):
        prompt = f"Summarize this chunk in 10 words: {chunk}"
        summary = call_llm(prompt)
        return summary

    def post(self, shared, prep_res, exec_res_list):
        combined = "\n".join(exec_res_list)
        shared["summary"] = combined
        return "default"

map_summaries = MapSummaries()
flow = Flow(start=map_summaries)
flow.run(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class MapSummaries extends BatchNode {
  prep(shared: any): string[] {
    // Suppose we have a big file; chunk it
    const content = shared['data']
    const chunkSize = 10000
    const chunks: string[] = []
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize))
    }
    return chunks
  }

  exec(chunk: string): string {
    const prompt = `Summarize this chunk in 10 words: ${chunk}`
    const summary = callLLM(prompt)
    return summary
  }

  post(shared: any, prepRes: string[], execResList: string[]): string {
    const combined = execResList.join('\n')
    shared['summary'] = combined
    return 'default'
  }
}

const mapSummaries = new MapSummaries()
const flow = new Flow(mapSummaries)
flow.run(shared)
```

{% endtab %}
{% endtabs %}

---

## 2. BatchFlow

A **BatchFlow** runs a **Flow** multiple times, each time with different `params`. Think of it as a loop that replays the Flow for each parameter set.

### Example: Summarize Many Files

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeAllFiles(BatchFlow):
    def prep(self, shared):
        # Return a list of param dicts (one per file)
        filenames = list(shared["data"].keys())  # e.g., ["file1.txt", "file2.txt", ...]
        return [{"filename": fn} for fn in filenames]

# Suppose we have a per-file Flow (e.g., load_file >> summarize >> reduce):
summarize_file = SummarizeFile(start=load_file)

# Wrap that flow into a BatchFlow:
summarize_all_files = SummarizeAllFiles(start=summarize_file)
summarize_all_files.run(shared)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeAllFiles extends BatchFlow {
  prep(shared: any): Array<Record<string, string>> {
    // Return a list of param dicts (one per file)
    const filenames = Object.keys(shared['data']) // e.g., ["file1.txt", "file2.txt", ...]
    return filenames.map((fn) => ({ filename: fn }))
  }
}

// Suppose we have a per-file Flow (e.g., load_file >> summarize >> reduce):
const summarizeFile = new SummarizeFile(loadFile)

// Wrap that flow into a BatchFlow:
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

## 3. Nested or Multi-Level Batches

You can nest a **BatchFlow** in another **BatchFlow**. For instance:

- **Outer** batch: returns a list of diretory param dicts (e.g., `{"directory": "/pathA"}`, `{"directory": "/pathB"}`, ...).
- **Inner** batch: returning a list of per-file param dicts.

At each level, **BatchFlow** merges its own param dict with the parent’s. By the time you reach the **innermost** node, the final `params` is the merged result of **all** parents in the chain. This way, a nested structure can keep track of the entire context (e.g., directory + file name) at once.

{% tabs %}
{% tab title="Python" %}

```python
class FileBatchFlow(BatchFlow):
    def prep(self, shared):
        directory = self.params["directory"]
        # e.g., files = ["file1.txt", "file2.txt", ...]
        files = [f for f in os.listdir(directory) if f.endswith(".txt")]
        return [{"filename": f} for f in files]

class DirectoryBatchFlow(BatchFlow):
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
class FileBatchFlow extends BatchFlow {
  prep(shared: any): Array<Record<string, string>> {
    const directory = this.params['directory']
    // In real code you would use fs.readdirSync() or similar
    // For example purposes we'll mock some files
    const files = ['file1.txt', 'file2.txt'].filter((f) => f.endsWith('.txt'))
    return files.map((f) => ({ filename: f }))
  }
}

class DirectoryBatchFlow extends BatchFlow {
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
