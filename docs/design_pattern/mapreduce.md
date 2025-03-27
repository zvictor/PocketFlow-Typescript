---
layout: default
title: 'Map Reduce'
parent: 'Design Pattern'
nav_order: 4
---

# Map Reduce

MapReduce is a design pattern suitable when you have either:

- Large input data (e.g., multiple files to process), or
- Large output data (e.g., multiple forms to fill)

and there is a logical way to break the task into smaller, ideally independent parts.

<div align="center">
  <img src="https://github.com/the-pocket/.github/raw/main/assets/mapreduce.png?raw=true" width="400"/>
</div>

You first break down the task using [BatchNode](../core_abstraction/batch.md) in the map phase, followed by aggregation in the reduce phase.

### Example: Document Summarization

{% tabs %}
{% tab title="Python" %}

```python
class SummarizeAllFiles(BatchNode):
    def prep(self, shared):
        files_dict = shared["files"]  # e.g. 10 files
        return list(files_dict.items())  # [("file1.txt", "aaa..."), ("file2.txt", "bbb..."), ...]

    def exec(self, one_file):
        filename, file_content = one_file
        summary_text = call_llm(f"Summarize the following file:\n{file_content}")
        return (filename, summary_text)

    def post(self, shared, prep_res, exec_res_list):
        shared["file_summaries"] = dict(exec_res_list)

class CombineSummaries(Node):
    def prep(self, shared):
        return shared["file_summaries"]

    def exec(self, file_summaries):
        # format as: "File1: summary\nFile2: summary...\n"
        text_list = []
        for fname, summ in file_summaries.items():
            text_list.append(f"{fname} summary:\n{summ}\n")
        big_text = "\n---\n".join(text_list)

        return call_llm(f"Combine these file summaries into one final summary:\n{big_text}")

    def post(self, shared, prep_res, final_summary):
        shared["all_files_summary"] = final_summary

batch_node = SummarizeAllFiles()
combine_node = CombineSummaries()
batch_node >> combine_node

flow = Flow(start=batch_node)

shared = {
    "files": {
        "file1.txt": "Alice was beginning to get very tired of sitting by her sister...",
        "file2.txt": "Some other interesting text ...",
        # ...
    }
}
flow.run(shared)
print("Individual Summaries:", shared["file_summaries"])
print("\nFinal Summary:\n", shared["all_files_summary"])
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class SummarizeAllFiles extends BatchNode {
  prep(shared: any): [string, string][] {
    const filesDict = shared.files // e.g. 10 files
    return Object.entries(filesDict) // [["file1.txt", "aaa..."], ["file2.txt", "bbb..."], ...]
  }

  exec(oneFile: [string, string]): [string, string] {
    const [filename, fileContent] = oneFile
    const summaryText = callLLM(`Summarize the following file:\n${fileContent}`)
    return [filename, summaryText]
  }

  post(shared: any, prepRes: any, execResList: [string, string][]): void {
    shared.file_summaries = Object.fromEntries(execResList)
  }
}

class CombineSummaries extends Node {
  prep(shared: any): Record<string, string> {
    return shared.file_summaries
  }

  exec(fileSummaries: Record<string, string>): string {
    // format as: "File1: summary\nFile2: summary...\n"
    const textList: string[] = []
    for (const [fname, summ] of Object.entries(fileSummaries)) {
      textList.push(`${fname} summary:\n${summ}\n`)
    }
    const bigText = textList.join('\n---\n')

    return callLLM(`Combine these file summaries into one final summary:\n${bigText}`)
  }

  post(shared: any, prepRes: any, finalSummary: string): void {
    shared.all_files_summary = finalSummary
  }
}

const batchNode = new SummarizeAllFiles()
const combineNode = new CombineSummaries()
batchNode.next(combineNode)

const flow = new Flow(batchNode)

const shared = {
  files: {
    'file1.txt': 'Alice was beginning to get very tired of sitting by her sister...',
    'file2.txt': 'Some other interesting text ...',
    // ...
  },
}
flow.run(shared)
console.log('Individual Summaries:', shared.file_summaries)
console.log('\nFinal Summary:\n', shared.all_files_summary)
```

{% endtab %}
{% endtabs %}

{% hint style="info" %}
**Performance Tip**: The example above works sequentially. You can speed up the map phase by running it in parallel. See [(Advanced) Parallel](../core_abstraction/parallel.md) for more details.
{% endhint %}
