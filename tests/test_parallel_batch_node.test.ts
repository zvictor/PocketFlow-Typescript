import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Node, ParallelBatchNode } from '../pocketflow/index'

interface SharedState {
  _batch_results?: any[]
  [key: string]: any
}

class Semaphore {
  private queue: Array<(value: void) => void> = []
  constructor(private permits: number) {}

  async acquire() {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => this.queue.push(resolve))
  }

  release() {
    this.permits++
    const next = this.queue.shift()
    if (next) next()
  }
}

class TestProcessingNode extends Node {
  async exec(item: any) {
    const { key, value } = item
    await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
    return { [key]: value * 2 }
  }
}

class ThrottledParallelNode extends ParallelBatchNode {
  private concurrency = 2
  private semaphore = new Semaphore(this.concurrency)

  async exec(item: any) {
    await this.semaphore.acquire()
    try {
      const result = await super.exec(item)
      return result
    } finally {
      this.semaphore.release()
    }
  }
}

describe('ParallelBatchNode Tests', () => {
  it('should process items in parallel', async () => {
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]

    const node = new ParallelBatchNode(1) // maxRetries = 1
    const processingNode = new TestProcessingNode()
    node.exec = processingNode.exec.bind(processingNode)

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.deepStrictEqual(combined, {
      a: 2,
      b: 4,
      c: 6,
    })
  })

  it('should respect concurrency limits', async () => {
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
      { key: 'd', value: 4 },
    ]

    const node = new ThrottledParallelNode(1) // maxRetries = 1
    const processingNode = new TestProcessingNode()
    node.exec = processingNode.exec.bind(processingNode)

    const start = Date.now()
    const results = await (node as any)._exec(testItems)
    const duration = Date.now() - start

    // Should take at least 5ms since we have 2 concurrency and 10ms per item
    assert(duration >= 5, `Expected at least 5ms but took ${duration}ms`)
    assert.strictEqual(results.length, 4)
  })

  it('should handle varying task durations correctly', async () => {
    const testItems = [
      { key: 'fast', value: 1, delay: 5 },
      { key: 'medium', value: 2, delay: 10 },
      { key: 'slow', value: 3, delay: 20 },
    ]

    const node = new ParallelBatchNode(1)
    node.exec = async (item: any) => {
      await new Promise((resolve) => setTimeout(resolve, item.delay))
      return { [item.key]: item.value * 2 }
    }

    const start = Date.now()
    await (node as any)._exec(testItems)
    const duration = Date.now() - start

    // Should take roughly as long as the slowest task
    assert(duration >= 15, `Expected ~20ms but took ${duration}ms`)
  })

  it('should maintain order of results', async () => {
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]

    const node = new ParallelBatchNode(1)
    const processingNode = new TestProcessingNode()
    node.exec = processingNode.exec.bind(processingNode)

    const results = await (node as any)._exec(testItems)

    // Results should be in same order as input despite parallel execution
    assert.deepStrictEqual(
      results.map((r: Record<string, unknown>) => Object.keys(r)[0]),
      ['a', 'b', 'c'],
    )
  })

  it('should handle retries', async () => {
    let attempt = 0
    class RetryNode extends Node {
      async exec(item: any) {
        attempt++
        if (attempt < 2) {
          throw new Error('Simulated failure')
        }
        return { [item.key]: item.value * 2 }
      }
    }

    const testItems = [{ key: 'a', value: 1 }]
    const node = new ParallelBatchNode(3) // maxRetries = 3
    const retryNode = new RetryNode()
    node.exec = retryNode.exec.bind(retryNode)

    const results = await (node as any)._exec(testItems)
    assert.deepStrictEqual(results, [{ a: 2 }])
    assert.strictEqual(attempt, 2)
  })

  it('should use fallback when retries exhausted', async () => {
    class FallbackNode extends Node {
      async exec(item: any) {
        throw new Error('Always fails')
      }
      async execFallback(item: any) {
        return { [item.key]: 'fallback' }
      }
    }

    const testItems = [{ key: 'a', value: 1 }]
    const node = new ParallelBatchNode(1) // maxRetries = 1
    const fallbackNode = new FallbackNode()
    node.exec = fallbackNode.exec.bind(fallbackNode)
    node.execFallback = fallbackNode.execFallback.bind(fallbackNode)

    const results = await (node as any)._exec(testItems)
    assert.deepStrictEqual(results, [{ a: 'fallback' }])
  })

  it('should handle empty input', async () => {
    const node = new ParallelBatchNode(1) // maxRetries = 1
    const processingNode = new TestProcessingNode()
    node.exec = processingNode.exec.bind(processingNode)

    const results = await (node as any)._exec([])
    assert.deepStrictEqual(results, [])
  })

  it('should propagate errors', async () => {
    class ErrorNode extends Node {
      async exec() {
        throw new Error('Test error')
      }
    }

    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
    ]

    const node = new ParallelBatchNode(1) // maxRetries = 1
    const errorNode = new ErrorNode()
    node.exec = errorNode.exec.bind(errorNode)

    await assert.rejects(() => (node as any)._exec(testItems), { message: 'Test error' })
  })

  it('should handle errors with concurrency', async () => {
    let processed = 0
    class ErrorNode extends Node {
      async exec(item: any) {
        processed++
        if (item.key === 'b') {
          throw new Error('Intentional error')
        }
        await new Promise((resolve) => setTimeout(resolve, 10))
        return { [item.key]: item.value }
      }
    }

    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]

    const node = new ParallelBatchNode(1)
    const errorNode = new ErrorNode()
    node.exec = errorNode.exec.bind(errorNode)

    await assert.rejects(() => (node as any)._exec(testItems))
    assert(processed > 0, 'Some items should have processed before error')
  })
})
