import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncBatchNode, AsyncFlow, AsyncNode } from '../pocketflow/index'

class AsyncArrayChunkNode extends AsyncBatchNode {
  constructor(private chunkSize = 10) {
    super()
  }

  async prepAsync(sharedStorage: Record<string, any>) {
    const array = sharedStorage['input_array'] || []
    const chunks = []
    for (let start = 0; start < array.length; start += this.chunkSize) {
      const end = Math.min(start + this.chunkSize, array.length)
      chunks.push(array.slice(start, end))
    }
    return chunks
  }

  async execAsync(chunk: number[]) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return chunk.reduce((sum, num) => sum + num, 0)
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    sharedStorage['chunk_results'] = procResult
    return 'processed'
  }
}

class AsyncSumReduceNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    const chunkResults = sharedStorage['chunk_results'] || []
    await new Promise((resolve) => setTimeout(resolve, 10))
    const total = chunkResults.reduce((sum: number, num: number) => sum + num, 0)
    sharedStorage['total'] = total
    return 'reduced'
  }
}

describe('AsyncBatchNode Tests', () => {
  it('should handle array chunking', async () => {
    const sharedStorage: Record<string, any> = {
      input_array: Array.from({ length: 25 }, (_, i) => i), // [0,1,2,...,24]
    }

    const chunkNode = new AsyncArrayChunkNode(10)
    await chunkNode.runAsync(sharedStorage)

    assert.deepStrictEqual(
      sharedStorage['chunk_results'],
      [45, 145, 110], // Sum of chunks [0-9], [10-19], [20-24]
    )
  })

  it('should handle async map-reduce sum', async () => {
    const array = Array.from({ length: 100 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0) // 4950

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new AsyncArrayChunkNode(10)
    const reduceNode = new AsyncSumReduceNode()
    chunkNode.minus('processed').rshift(reduceNode)

    const pipeline = new AsyncFlow(chunkNode)
    await pipeline.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle uneven chunks', async () => {
    const array = Array.from({ length: 25 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0) // 300

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new AsyncArrayChunkNode(10)
    const reduceNode = new AsyncSumReduceNode()
    chunkNode.minus('processed').rshift(reduceNode)

    const pipeline = new AsyncFlow(chunkNode)
    await pipeline.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle custom chunk sizes', async () => {
    const array = Array.from({ length: 100 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0)

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new AsyncArrayChunkNode(15) // Custom chunk size
    const reduceNode = new AsyncSumReduceNode()
    chunkNode.minus('processed').rshift(reduceNode)

    const pipeline = new AsyncFlow(chunkNode)
    await pipeline.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle single element chunks', async () => {
    const array = Array.from({ length: 5 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0)

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new AsyncArrayChunkNode(1) // Single element chunks
    const reduceNode = new AsyncSumReduceNode()
    chunkNode.minus('processed').rshift(reduceNode)

    const pipeline = new AsyncFlow(chunkNode)
    await pipeline.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle empty array', async () => {
    const sharedStorage: Record<string, any> = {
      input_array: [],
    }

    const chunkNode = new AsyncArrayChunkNode(10)
    const reduceNode = new AsyncSumReduceNode()
    chunkNode.minus('processed').rshift(reduceNode)

    const pipeline = new AsyncFlow(chunkNode)
    await pipeline.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['total'], 0)
  })

  it('should handle error handling', async () => {
    class ErrorAsyncBatchNode extends AsyncBatchNode {
      async prepAsync(shared: any): Promise<any[]> {
        return shared.input_array || []
      }

      async execAsync(item: number) {
        if (item === 2) {
          throw new Error('Error processing item 2')
        }
        return item
      }
    }

    const sharedStorage: Record<string, any> = {
      input_array: [1, 2, 3],
    }

    const errorNode = new ErrorAsyncBatchNode()
    await assert.rejects(async () => {
      await errorNode.runAsync(sharedStorage)
    }, Error)
  })
})
