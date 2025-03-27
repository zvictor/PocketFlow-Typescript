import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Flow, Node } from '../pocketflow/index'

class FallbackNode extends Node {
  constructor(
    private shouldFail = true,
    maxRetries = 1,
    private customFallbackResult?: string,
  ) {
    super(maxRetries)
    this.shouldFail = shouldFail
  }

  async prep(sharedStorage: Record<string, any>) {
    if (!sharedStorage['results']) {
      sharedStorage['results'] = []
    }
    return null
  }

  async exec(prepResult: any) {
    if (this.shouldFail) {
      throw new Error('Intentional failure')
    }
    return 'success'
  }

  async execFallback(prepResult: any, exc: Error) {
    await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
    return this.customFallbackResult || 'fallback'
  }

  async post(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['results'].push({
      attempts: this.curRetry + 1,
      result: execResult,
      error: prepResult?.error || null,
    })
  }
}

class ConditionalFallbackNode extends Node {
  async exec(item: any) {
    if (item.type === 'invalid') {
      throw new Error('Invalid item')
    }
    return { ...item, processed: true }
  }

  async execFallback(item: any, exc: Error) {
    if (item.type === 'invalid-but-recoverable') {
      return { ...item, processed: false, error: exc.message }
    }
    throw exc // Re-throw for unrecoverable items
  }
}

describe('Fallback Tests', () => {
  it('should not call fallback when execution succeeds', async () => {
    const sharedStorage: Record<string, any> = {}
    const node = new FallbackNode(false)
    await node.run(sharedStorage)

    assert.strictEqual(sharedStorage['results'].length, 1)
    assert.strictEqual(sharedStorage['results'][0].attempts, 1)
    assert.strictEqual(sharedStorage['results'][0].result, 'success')
  })

  it('should call fallback after retries are exhausted', async () => {
    const sharedStorage: Record<string, any> = {}
    const node = new FallbackNode(true, 2)
    await node.run(sharedStorage)

    assert.strictEqual(sharedStorage['results'].length, 1)
    assert.strictEqual(sharedStorage['results'][0].attempts, 2)
    assert.strictEqual(sharedStorage['results'][0].result, 'fallback')
  })

  it('should handle custom fallback results', async () => {
    const sharedStorage: Record<string, any> = {}
    const node = new FallbackNode(true, 1, 'custom_fallback')
    await node.run(sharedStorage)

    assert.strictEqual(sharedStorage['results'][0].result, 'custom_fallback')
  })

  it('should handle conditional fallback', async () => {
    const testItems = [
      { id: 1, type: 'valid' },
      { id: 2, type: 'invalid-but-recoverable' },
      { id: 3, type: 'invalid' },
    ]

    const node = new ConditionalFallbackNode()
    const results = await Promise.allSettled(testItems.map((item) => node.exec(item)))

    assert.deepStrictEqual(results[0].status, 'fulfilled')
    assert.deepStrictEqual(results[1].status, 'fulfilled')
    assert.deepStrictEqual(results[2].status, 'rejected')
  })

  it('should handle nested fallback in flow', async () => {
    class InnerNode extends Node {
      async prep() {
        return {}
      }

      async exec() {
        throw new Error('Inner failure')
      }

      async execFallback(prepRes: any) {
        return { recovered: true }
      }

      async post(shared: any, prepRes: any, execRes: any) {
        shared.recovered = execRes.recovered
        return 'default' // Explicitly return default action
      }
    }

    class OuterNode extends Node {
      async prep(shared: any) {
        if (!shared.recovered) {
          throw new Error('Recovery failed')
        }
        return shared
      }

      async exec(input: any) {
        return 'success'
      }

      async post(shared: any, prepRes: any, execRes: any) {
        shared.result = execRes // Store result in shared state
        return 'success' // Explicitly return success action
      }
    }

    const inner = new InnerNode()
    const outer = new OuterNode()
    inner.next(outer)

    const flow = new Flow(inner)
    const shared: { result?: string } = {}
    const result = await flow.run(shared)

    // Verify both the shared state and flow return value
    assert.strictEqual(shared.result, 'success')
    assert.strictEqual(result, undefined) // Flow returns the last action from InnerNode but value gets discarded unless `.post` is implemented
  })

  it('should track error context in fallback', async () => {
    const sharedStorage: Record<string, any> = { results: [] }
    const node = new FallbackNode(true, 1)
    node.exec = async () => {
      const err = new Error('Failed with context')
      throw Object.assign(err, { context: { itemId: 123 } })
    }

    node.execFallback = async (_, exc: any) => {
      return JSON.stringify({ error: exc })
    }

    node.post = async (sharedStorage, _, execResult) => {
      sharedStorage['results'].push({
        attempts: 1,
        result: JSON.parse(execResult),
        error: null,
      })
    }

    await node.run(sharedStorage)
    assert.strictEqual(sharedStorage['results'][0].result.error.context.itemId, 123)
  })

  it('should handle fallback with async side effects', async () => {
    let cleanupCalled = false
    const node = new FallbackNode(true, 1)
    node.execFallback = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      cleanupCalled = true
      return 'cleanup_complete'
    }

    await node.run({})
    assert(cleanupCalled)
  })

  it('should maintain state between retries', async () => {
    let attemptCount = 0
    const node = new FallbackNode(true, 3)
    node.exec = async () => {
      attemptCount++
      throw new Error(`Attempt ${attemptCount}`)
    }

    node.execFallback = async (_, exc) => {
      return exc.message
    }

    await node.run({})
    assert.strictEqual(attemptCount, 3)
  })
})
