import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BatchNode, Flow, Node } from '../pocketflow/index'

class ArrayChunkNode extends BatchNode {
  constructor(private chunkSize = 10) {
    super()
  }

  prep(sharedStorage: Record<string, any>) {
    const array = sharedStorage['input_array'] || []
    const chunks = []
    for (let start = 0; start < array.length; start += this.chunkSize) {
      const end = Math.min(start + this.chunkSize, array.length)
      chunks.push(array.slice(start, end))
    }
    return chunks
  }

  exec(chunk: number[]) {
    return chunk.reduce((sum: number, num: number) => sum + num, 0)
  }

  post(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    sharedStorage['chunk_results'] = procResult
    return 'default'
  }
}

class SumReduceNode extends Node {
  prep(sharedStorage: Record<string, any>) {
    const chunkResults: number[] = sharedStorage['chunk_results'] || []
    const total = chunkResults.reduce((sum: number, num: number) => sum + num, 0)
    sharedStorage['total'] = total
  }
}

describe('BatchNode Tests', () => {
  it('should handle array chunking', () => {
    const sharedStorage: Record<string, any> = {
      input_array: Array.from({ length: 25 }, (_, i) => i), // [0,1,2,...,24]
    }

    const chunkNode = new ArrayChunkNode(10)
    chunkNode.run(sharedStorage)

    assert.deepStrictEqual(
      sharedStorage['chunk_results'],
      [45, 145, 110], // Sum of chunks [0-9], [10-19], [20-24]
    )
  })

  it('should handle map-reduce sum', () => {
    const array = Array.from({ length: 100 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0) // 4950

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new ArrayChunkNode(10)
    const reduceNode = new SumReduceNode()
    chunkNode.rshift(reduceNode)

    const pipeline = new Flow(chunkNode)
    pipeline.run(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle uneven chunks', () => {
    const array = Array.from({ length: 25 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0) // 300

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new ArrayChunkNode(10)
    const reduceNode = new SumReduceNode()
    chunkNode.rshift(reduceNode)

    const pipeline = new Flow(chunkNode)
    pipeline.run(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle custom chunk sizes', () => {
    const array = Array.from({ length: 100 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0)

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new ArrayChunkNode(15) // Custom chunk size
    const reduceNode = new SumReduceNode()
    chunkNode.rshift(reduceNode)

    const pipeline = new Flow(chunkNode)
    pipeline.run(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle single element chunks', () => {
    const array = Array.from({ length: 5 }, (_, i) => i)
    const expectedSum = array.reduce((sum, num) => sum + num, 0)

    const sharedStorage: Record<string, any> = {
      input_array: array,
    }

    const chunkNode = new ArrayChunkNode(1) // Single element chunks
    const reduceNode = new SumReduceNode()
    chunkNode.rshift(reduceNode)

    const pipeline = new Flow(chunkNode)
    pipeline.run(sharedStorage)

    assert.strictEqual(sharedStorage['total'], expectedSum)
  })

  it('should handle empty array', () => {
    const sharedStorage: Record<string, any> = {
      input_array: [],
    }

    const chunkNode = new ArrayChunkNode(10)
    const reduceNode = new SumReduceNode()
    chunkNode.rshift(reduceNode)

    const pipeline = new Flow(chunkNode)
    pipeline.run(sharedStorage)

    assert.strictEqual(sharedStorage['total'], 0)
  })
})
