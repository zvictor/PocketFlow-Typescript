---
layout: default
title: "RAG"
parent: "Design Pattern"
nav_order: 3
---

# RAG (Retrieval Augmented Generation)

For certain LLM tasks like answering questions, providing relevant context is essential. One common architecture is a **two-stage** RAG pipeline:

<div align="center">
  <img src="https://github.com/the-pocket/.github/raw/main/assets/rag.png?raw=true" width="400"/>
</div>

1. **Offline stage**: Preprocess and index documents ("building the index").
2. **Online stage**: Given a question, generate answers by retrieving the most relevant context.

---

## Stage 1: Offline Indexing

We create three Nodes:

1. `ChunkDocs` – [chunks](../utility_function/chunking.md) raw text.
2. `EmbedDocs` – [embeds](../utility_function/embedding.md) each chunk.
3. `StoreIndex` – stores embeddings into a [vector database](../utility_function/vector.md).

{% tabs %}
{% tab title="Python" %}

```python
class ChunkDocs(BatchNode):
    def prep(self, shared):
        # A list of file paths in shared["files"]. We process each file.
        return shared["files"]

    def exec(self, filepath):
        # read file content. In real usage, do error handling.
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
        # chunk by 100 chars each
        chunks = []
        size = 100
        for i in range(0, len(text), size):
            chunks.append(text[i : i + size])
        return chunks

    def post(self, shared, prep_res, exec_res_list):
        # exec_res_list is a list of chunk-lists, one per file.
        # flatten them all into a single list of chunks.
        all_chunks = []
        for chunk_list in exec_res_list:
            all_chunks.extend(chunk_list)
        shared["all_chunks"] = all_chunks
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class ChunkDocs extends BatchNode {
  prep(shared: any): string[] {
    // A list of file paths in shared["files"]. We process each file.
    return shared['files']
  }

  exec(filepath: string): string[] {
    // read file content. In real usage, do error handling.
    const text = fs.readFileSync(filepath, 'utf-8')
    // chunk by 100 chars each
    const chunks: string[] = []
    const size = 100
    for (let i = 0; i < text.length; i += size) {
      chunks.push(text.slice(i, i + size))
    }
    return chunks
  }

  post(shared: any, prepRes: string[], execResList: string[][]): void {
    // execResList is a list of chunk-lists, one per file.
    // flatten them all into a single list of chunks.
    const allChunks: string[] = []
    for (const chunkList of execResList) {
      allChunks.push(...chunkList)
    }
    shared['all_chunks'] = allChunks
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class EmbedDocs(BatchNode):
    def prep(self, shared):
        return shared["all_chunks"]

    def exec(self, chunk):
        return get_embedding(chunk)

    def post(self, shared, prep_res, exec_res_list):
        # Store the list of embeddings.
        shared["all_embeds"] = exec_res_list
        print(f"Total embeddings: {len(exec_res_list)}")
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class EmbedDocs extends BatchNode {
  prep(shared: any): string[] {
    return shared['all_chunks']
  }

  exec(chunk: string): number[] {
    return getEmbedding(chunk)
  }

  post(shared: any, prepRes: string[], execResList: number[][]): void {
    // Store the list of embeddings.
    shared['all_embeds'] = execResList
    console.log(`Total embeddings: ${execResList.length}`)
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class StoreIndex(Node):
    def prep(self, shared):
        # We'll read all embeds from shared.
        return shared["all_embeds"]

    def exec(self, all_embeds):
        # Create a vector index (faiss or other DB in real usage).
        index = create_index(all_embeds)
        return index

    def post(self, shared, prep_res, index):
        shared["index"] = index
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class StoreIndex extends Node {
  prep(shared: any): number[][] {
    // We'll read all embeds from shared.
    return shared['all_embeds']
  }

  exec(allEmbeds: number[][]): any {
    // Create a vector index (faiss or other DB in real usage).
    const index = createIndex(allEmbeds)
    return index
  }

  post(shared: any, prepRes: number[][], index: any): void {
    shared['index'] = index
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
# Wire them in sequence
chunk_node = ChunkDocs()
embed_node = EmbedDocs()
store_node = StoreIndex()

chunk_node >> embed_node >> store_node

OfflineFlow = Flow(start=chunk_node)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// Wire them in sequence
const chunkNode = new ChunkDocs()
const embedNode = new EmbedDocs()
const storeNode = new StoreIndex()

chunkNode.rshift(embedNode).rshift(storeNode)

const OfflineFlow = new Flow(chunkNode)
```

{% endtab %}
{% endtabs %}

Usage example:

{% tabs %}
{% tab title="Python" %}
```python
shared = {
    "files": ["doc1.txt", "doc2.txt"],  # any text files
}
OfflineFlow.run(shared)

{% endtab %}

{% tab title="TypeScript" %}

```typescript
const shared = {
  files: ['doc1.txt', 'doc2.txt'], // any text files
}
OfflineFlow.run(shared)
```

{% endtab %}
{% endtabs %}

---

## Stage 2: Online Query & Answer

We have 3 nodes:

1. `EmbedQuery` – embeds the user’s question.
2. `RetrieveDocs` – retrieves top chunk from the index.
3. `GenerateAnswer` – calls the LLM with the question + chunk to produce the final answer.

{% tabs %}
{% tab title="Python" %}
```python
class EmbedQuery(Node):
    def prep(self, shared):
        return shared["question"]

    def exec(self, question):
        return get_embedding(question)

    def post(self, shared, prep_res, q_emb):
        shared["q_emb"] = q_emb

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class EmbedQuery extends Node {
  prep(shared: any): string {
    return shared['question']
  }

  exec(question: string): number[] {
    return getEmbedding(question)
  }

  post(shared: any, prepRes: string, qEmb: number[]): void {
    shared['q_emb'] = qEmb
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class RetrieveDocs(Node):
    def prep(self, shared):
        # We'll need the query embedding, plus the offline index/chunks
        return shared["q_emb"], shared["index"], shared["all_chunks"]

    def exec(self, inputs):
        q_emb, index, chunks = inputs
        I, D = search_index(index, q_emb, top_k=1)
        best_id = I[0][0]
        relevant_chunk = chunks[best_id]
        return relevant_chunk

    def post(self, shared, prep_res, relevant_chunk):
        shared["retrieved_chunk"] = relevant_chunk
        print("Retrieved chunk:", relevant_chunk[:60], "...")
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class RetrieveDocs extends Node {
  prep(shared: any): [number[], any, string[]] {
    // We'll need the query embedding, plus the offline index/chunks
    return [shared['q_emb'], shared['index'], shared['all_chunks']]
  }

  exec(inputs: [number[], any, string[]]): string {
    const [qEmb, index, chunks] = inputs
    const [I, D] = searchIndex(index, qEmb, 1)
    const bestId = I[0][0]
    const relevantChunk = chunks[bestId]
    return relevantChunk
  }

  post(shared: any, prepRes: [number[], any, string[]], relevantChunk: string): void {
    shared['retrieved_chunk'] = relevantChunk
    console.log(`Retrieved chunk: ${relevantChunk.slice(0, 60)}...`)
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
class GenerateAnswer(Node):
    def prep(self, shared):
        return shared["question"], shared["retrieved_chunk"]

    def exec(self, inputs):
        question, chunk = inputs
        prompt = f"Question: {question}\nContext: {chunk}\nAnswer:"
        return call_llm(prompt)

    def post(self, shared, prep_res, answer):
        shared["answer"] = answer
        print("Answer:", answer)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
class GenerateAnswer extends Node {
  prep(shared: any): [string, string] {
    return [shared['question'], shared['retrieved_chunk']]
  }

  exec(inputs: [string, string]): string {
    const [question, chunk] = inputs
    const prompt = `Question: ${question}\nContext: ${chunk}\nAnswer:`
    return callLLM(prompt)
  }

  post(shared: any, prepRes: [string, string], answer: string): void {
    shared['answer'] = answer
    console.log(`Answer: ${answer}`)
  }
}
```

{% endtab %}
{% endtabs %}

{% tabs %}
{% tab title="Python" %}

```python
embed_qnode = EmbedQuery()
retrieve_node = RetrieveDocs()
generate_node = GenerateAnswer()

embed_qnode >> retrieve_node >> generate_node
OnlineFlow = Flow(start=embed_qnode)
```

{% endtab %}

{% tab title="TypeScript" %}

```typescript
const embedQNode = new EmbedQuery()
const retrieveNode = new RetrieveDocs()
const generateNode = new GenerateAnswer()

embedQNode.rshift(retrieveNode).rshift(generateNode)
const OnlineFlow = new Flow(embedQNode)
```

{% endtab %}
{% endtabs %}

Usage example:

{% tabs %}
{% tab title="Python" %}
```python
# Suppose we already ran OfflineFlow and have:
# shared["all_chunks"], shared["index"], etc.
shared["question"] = "Why do people like cats?"

OnlineFlow.run(shared)
# final answer in shared["answer"]

{% endtab %}

{% tab title="TypeScript" %}

```typescript
// Suppose we already ran OfflineFlow and have:
// shared["all_chunks"], shared["index"], etc.
shared['question'] = 'Why do people like cats?'

OnlineFlow.run(shared)
// final answer in shared["answer"]
```

{% endtab %}
{% endtabs %}

```

```
