import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncNode, AsyncParallelBatchFlow, AsyncParallelBatchNode } from '../pocketflow/index'

// This processor extends AsyncParallelBatchNode to properly handle batch processing
class AsyncParallelNumberProcessor extends AsyncParallelBatchNode {
  constructor(private delay = 0.1) {
    super()
  }

  async prepAsync(sharedStorage: Record<string, any>) {
    return sharedStorage['batches'][this.params['batch_id']]
  }

  async execAsync(number: number) {
    await new Promise((resolve) => setTimeout(resolve, this.delay * 1000))
    return number * 2
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    if (!sharedStorage['processed_numbers']) {
      sharedStorage['processed_numbers'] = {}
    }

    sharedStorage['processed_numbers'][this.params['batch_id']] = execResult
    return 'processed'
  }
}

class AsyncAggregatorNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    const allResults: number[] = []
    const processed = sharedStorage['processed_numbers'] || {}

    // Ensure we're iterating over arrays properly
    Object.keys(processed).forEach((key) => {
      const value = processed[key]
      if (Array.isArray(value)) {
        // Ensure we're only adding numbers
        value.forEach((item) => {
          if (typeof item === 'number') {
            allResults.push(item)
          }
        })
      }
    })

    return allResults
  }

  async execAsync(prepResult: number[]) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return prepResult.reduce((sum, num) => sum + num, 0)
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['total'] = execResult
    return 'aggregated'
  }
}

describe('AsyncParallelBatchFlow Tests', () => {
  it('should handle parallel batch flow', async () => {
    class TestParallelBatchFlow extends AsyncParallelBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Array.from({ length: sharedStorage['batches'].length }, (_, i) => ({ batch_id: i }))
      }
    }

    const sharedStorage: Record<string, any> = {
      batches: [
        [1, 2, 3], // batch_id: 0
        [4, 5, 6], // batch_id: 1
        [7, 8, 9], // batch_id: 2
      ],
    }

    const processor = new AsyncParallelNumberProcessor(0.1)
    const aggregator = new AsyncAggregatorNode()
    processor.minus('processed').rshift(aggregator)

    const flow = new TestParallelBatchFlow(processor)
    const startTime = Date.now()
    await flow.runAsync(sharedStorage)
    const executionTime = Date.now() - startTime

    // Verify each batch was processed correctly
    assert.deepStrictEqual(sharedStorage['processed_numbers'], {
      0: [2, 4, 6], // [1,2,3] * 2
      1: [8, 10, 12], // [4,5,6] * 2
      2: [14, 16, 18], // [7,8,9] * 2
    })

    // Verify total
    const expectedTotal = sharedStorage['batches']
      .flat()
      .reduce((sum: number, num: number) => sum + num * 2, 0)
    assert.strictEqual(sharedStorage['total'], expectedTotal)

    // Verify parallel execution (should be faster than sequential)
    assert.ok(executionTime < 200, `Execution took ${executionTime}ms`)
  })

  it('should handle error handling', async () => {
    class ErrorProcessor extends AsyncParallelBatchNode {
      async prepAsync(sharedStorage: Record<string, any>) {
        return sharedStorage['batches'][this.params['batch_id']]
      }

      async execAsync(item: number) {
        if (item === 2) {
          throw new Error(`Error processing item ${item}`)
        }
        return item
      }

      async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
        return 'processed'
      }
    }

    class ErrorBatchFlow extends AsyncParallelBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Array.from({ length: sharedStorage['batches'].length }, (_, i) => ({ batch_id: i }))
      }
    }

    const sharedStorage: Record<string, any> = {
      batches: [
        [1, 2, 3], // Contains error-triggering value
        [4, 5, 6],
      ],
    }

    const processor = new ErrorProcessor()
    const flow = new ErrorBatchFlow(processor)

    // This should reject because item 2 will throw an error
    await assert.rejects(async () => {
      await flow.runAsync(sharedStorage)
    }, Error)
  })

  it('should handle multiple batch sizes', async () => {
    class VaryingBatchFlow extends AsyncParallelBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Array.from({ length: sharedStorage['batches'].length }, (_, i) => ({ batch_id: i }))
      }
    }

    const sharedStorage: Record<string, any> = {
      batches: [
        [1], // batch_id: 0
        [2, 3, 4], // batch_id: 1
        [5, 6], // batch_id: 2
        [7, 8, 9, 10], // batch_id: 3
      ],
    }

    const processor = new AsyncParallelNumberProcessor(0.05)
    const aggregator = new AsyncAggregatorNode()
    processor.minus('processed').rshift(aggregator)

    const flow = new VaryingBatchFlow(processor)
    await flow.runAsync(sharedStorage)

    // Verify each batch was processed correctly
    assert.deepStrictEqual(sharedStorage['processed_numbers'], {
      0: [2], // [1] * 2
      1: [4, 6, 8], // [2,3,4] * 2
      2: [10, 12], // [5,6] * 2
      3: [14, 16, 18, 20], // [7,8,9,10] * 2
    })

    // Verify total
    const expectedTotal = sharedStorage['batches']
      .flat()
      .reduce((sum: number, num: number) => sum + num * 2, 0)
    assert.strictEqual(sharedStorage['total'], expectedTotal)
  })
})
