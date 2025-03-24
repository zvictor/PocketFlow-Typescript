import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncFlow, AsyncNode, Flow, Node } from '../pocketflow/index'

// Synchronous test nodes
class FallbackNode extends Node {
  constructor(
    private shouldFail = true,
    maxRetries = 1,
  ) {
    super(maxRetries)
    this.shouldFail = shouldFail
    this.curRetry = 0
  }

  prep(sharedStorage: Record<string, any>) {
    if (!sharedStorage['results']) {
      sharedStorage['results'] = []
    }
    return null
  }

  exec(prepResult: any) {
    if (this.shouldFail) {
      throw new Error('Intentional failure')
    }
    return 'success'
  }

  execFallback(prepResult: any, exc: Error) {
    return 'fallback'
  }

  post(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['results'].push({
      attempts: this.curRetry + 1, // Match Python behavior where count starts at 1
      result: execResult,
    })
  }
}

class NoFallbackNode extends Node {
  prep(sharedStorage: Record<string, any>) {
    if (!sharedStorage['results']) {
      sharedStorage['results'] = []
    }
    return null
  }

  exec(prepResult: any) {
    throw new Error('Test error')
  }

  post(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['results'].push({ result: execResult })
    return execResult
  }
}

// Async test nodes
class AsyncFallbackNode extends AsyncNode {
  constructor(
    private shouldFail = true,
    maxRetries = 1,
  ) {
    super(maxRetries)
    this.shouldFail = shouldFail
    this.curRetry = 0
  }

  async prepAsync(sharedStorage: Record<string, any>) {
    if (!sharedStorage['results']) {
      sharedStorage['results'] = []
    }
    return null
  }

  async execAsync(prepResult: any) {
    if (this.shouldFail) {
      throw new Error('Intentional async failure')
    }
    return 'success'
  }

  async execFallbackAsync(prepResult: any, exc: Error) {
    await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
    return 'async_fallback'
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['results'].push({
      attempts: this.curRetry + 1, // Match Python behavior where count starts at 1
      result: execResult,
    })
  }
}

class NoFallbackAsyncNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    if (!sharedStorage['results']) {
      sharedStorage['results'] = []
    }
    return null
  }

  async execAsync(prepResult: any) {
    throw new Error('Test async error')
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
    sharedStorage['results'].push({ result: execResult })
    return execResult
  }
}

describe('Fallback Tests', () => {
  describe('Synchronous', () => {
    it('should not call fallback when execution succeeds', () => {
      const sharedStorage: Record<string, any> = {}
      const node = new FallbackNode(false)
      node.run(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 1) // First attempt succeeds
      assert.strictEqual(sharedStorage['results'][0].result, 'success')
    })

    it('should call fallback after retries are exhausted', () => {
      const sharedStorage: Record<string, any> = {}
      const node = new FallbackNode(true, 2)
      node.run(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 2) // Matches maxRetries
      assert.strictEqual(sharedStorage['results'][0].result, 'fallback')
    })

    it('should handle fallback in flow', () => {
      class ResultNode extends Node {
        prep(sharedStorage: Record<string, any>) {
          return sharedStorage['results']
        }

        exec(prepResult: any) {
          return prepResult
        }

        post(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
          sharedStorage['final_result'] = execResult
          return 'fallback'
        }
      }

      const sharedStorage: Record<string, any> = {}
      const fallbackNode = new FallbackNode(true)
      const resultNode = new ResultNode()
      fallbackNode.rshift(resultNode)

      // Run the flow
      const flow = new Flow(fallbackNode)
      const flowResult = flow.run(sharedStorage)

      // Verify the flow result is the post result from the last node
      assert.strictEqual(flowResult, 'fallback')

      // Verify the fallback node was executed and returned 'fallback'
      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].result, 'fallback')

      // Verify the result node received and processed the fallback result
      assert.deepStrictEqual(sharedStorage['final_result'], [{ attempts: 1, result: 'fallback' }])
    })

    it('should throw error when no fallback implementation', () => {
      const sharedStorage: Record<string, any> = {}
      const node = new NoFallbackNode()
      assert.throws(() => node.run(sharedStorage), Error)
    })

    it('should retry before calling fallback', () => {
      const sharedStorage: Record<string, any> = {}
      const node = new FallbackNode(true, 3)
      node.run(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 3) // Matches maxRetries
      assert.strictEqual(sharedStorage['results'][0].result, 'fallback')
    })
  })

  describe('Asynchronous', () => {
    it('should not call async fallback when execution succeeds', async () => {
      const sharedStorage: Record<string, any> = {}
      const node = new AsyncFallbackNode(false)
      await node.runAsync(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 1)
      assert.strictEqual(sharedStorage['results'][0].result, 'success')
    })

    it('should call async fallback after retries are exhausted', async () => {
      const sharedStorage: Record<string, any> = {}
      const node = new AsyncFallbackNode(true, 2)
      await node.runAsync(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 2)
      assert.strictEqual(sharedStorage['results'][0].result, 'async_fallback')
    })

    it('should handle async fallback in flow', async () => {
      class AsyncResultNode extends AsyncNode {
        async prepAsync(sharedStorage: Record<string, any>) {
          return sharedStorage['results'][0].result
        }

        async execAsync(prepResult: any) {
          return prepResult
        }

        async postAsync(sharedStorage: Record<string, any>, prepResult: any, execResult: any) {
          sharedStorage['final_result'] = execResult
          return 'async_fallback'
        }
      }

      const sharedStorage: Record<string, any> = {}
      const fallbackNode = new AsyncFallbackNode(true)
      const resultNode = new AsyncResultNode()
      fallbackNode.rshift(resultNode)

      const flow = new AsyncFlow(fallbackNode)
      const flowResult = await flow.runAsync(sharedStorage)

      // Verify the flow result is the post result from the last node
      assert.strictEqual(flowResult, 'async_fallback')

      // Verify the fallback node was executed and returned 'async_fallback'
      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].result, 'async_fallback')

      // Verify the result node received and processed the fallback result
      assert.strictEqual(sharedStorage['final_result'], 'async_fallback')
    })

    it('should throw error when no async fallback implementation', async () => {
      const sharedStorage: Record<string, any> = {}
      const node = new NoFallbackAsyncNode()
      await assert.rejects(async () => node.runAsync(sharedStorage), Error)
    })

    it('should retry before calling async fallback', async () => {
      const sharedStorage: Record<string, any> = {}
      const node = new AsyncFallbackNode(true, 3)
      await node.runAsync(sharedStorage)

      assert.strictEqual(sharedStorage['results'].length, 1)
      assert.strictEqual(sharedStorage['results'][0].attempts, 3)
      assert.strictEqual(sharedStorage['results'][0].result, 'async_fallback')
    })
  })
})
