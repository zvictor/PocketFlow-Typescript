import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncParallelBatchNode } from '../pocketflow/index'

class AsyncParallelNumberProcessor extends AsyncParallelBatchNode {
  constructor(private delay = 0.1) {
    super()
  }

  async prepAsync(sharedStorage: Record<string, any>) {
    const numbers = sharedStorage['input_numbers'] || []
    return numbers
  }

  async execAsync(number: number) {
    await new Promise((resolve) => setTimeout(resolve, this.delay * 1000))
    return number * 2
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['processed_numbers'] = execResult
    return 'processed'
  }
}

describe('AsyncParallelBatchNode Tests', () => {
  it('should handle parallel processing', async () => {
    const sharedStorage: Record<string, any> = {
      input_numbers: [0, 1, 2, 3, 4],
    }

    const processor = new AsyncParallelNumberProcessor(0.1)
    const startTime = Date.now()
    await processor.runAsync(sharedStorage)
    const executionTime = Date.now() - startTime

    assert.deepStrictEqual(
      sharedStorage['processed_numbers'],
      [0, 2, 4, 6, 8], // Each number doubled
    )
    assert.ok(executionTime < 200, `Execution took ${executionTime}ms`)
  })

  it('should handle empty input', async () => {
    const sharedStorage: Record<string, any> = {
      input_numbers: [],
    }

    const processor = new AsyncParallelNumberProcessor()
    await processor.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['processed_numbers'], [])
  })

  it('should handle single item', async () => {
    const sharedStorage: Record<string, any> = {
      input_numbers: [42],
    }

    const processor = new AsyncParallelNumberProcessor()
    await processor.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['processed_numbers'], [84])
  })

  it('should handle large batch', async () => {
    const inputSize = 100
    const sharedStorage: Record<string, any> = {
      input_numbers: Array.from({ length: inputSize }, (_, i) => i),
    }

    const processor = new AsyncParallelNumberProcessor(0.01)
    await processor.runAsync(sharedStorage)

    const expected = Array.from({ length: inputSize }, (_, i) => i * 2)
    assert.deepStrictEqual(sharedStorage['processed_numbers'], expected)
  })

  it('should handle error handling', async () => {
    class ErrorProcessor extends AsyncParallelNumberProcessor {
      async execAsync(item: number) {
        if (item === 2) {
          throw new Error(`Error processing item ${item}`)
        }
        return item
      }
    }

    const sharedStorage: Record<string, any> = {
      input_numbers: [1, 2, 3],
    }

    const processor = new ErrorProcessor()
    await assert.rejects(() => processor.runAsync(sharedStorage), Error)
  })

  it('should verify concurrent execution', async () => {
    const executionOrder: number[] = []

    class OrderTrackingProcessor extends AsyncParallelNumberProcessor {
      async execAsync(item: number) {
        const delay = item % 2 === 0 ? 0.1 : 0.05
        await new Promise((resolve) => setTimeout(resolve, delay * 1000))
        executionOrder.push(item)
        return item
      }
    }

    const sharedStorage: Record<string, any> = {
      input_numbers: [0, 1, 2, 3],
    }

    const processor = new OrderTrackingProcessor()
    await processor.runAsync(sharedStorage)

    // Odd numbers should finish before even numbers due to shorter delay
    assert.ok(executionOrder.indexOf(1) < executionOrder.indexOf(0))
    assert.ok(executionOrder.indexOf(3) < executionOrder.indexOf(2))
  })
})
