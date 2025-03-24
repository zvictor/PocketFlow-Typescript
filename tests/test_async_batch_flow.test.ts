import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncBatchFlow, AsyncNode } from '../pocketflow/index'

class AsyncDataProcessNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    const key = this.params['key']
    const data = sharedStorage['input_data'][key]
    if (!sharedStorage['results']) {
      sharedStorage['results'] = {}
    }
    sharedStorage['results'][key] = data
    return data
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    await new Promise((resolve) => setTimeout(resolve, 10)) // Simulate async work
    const key = this.params['key']
    sharedStorage['results'][key] = prepResult * 2 // Double the value
    return 'processed'
  }
}

class AsyncErrorNode extends AsyncNode {
  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    const key = this.params['key']
    if (key === 'error_key') {
      throw new Error(`Async error processing key: ${key}`)
    }
    return 'processed'
  }
}

describe('AsyncBatchFlow Tests', () => {
  it('should handle basic async batch processing', async () => {
    class SimpleTestAsyncBatchFlow extends AsyncBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        a: 1,
        b: 2,
        c: 3,
      },
    }

    const flow = new SimpleTestAsyncBatchFlow(new AsyncDataProcessNode())
    await flow.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      a: 2, // 1 * 2
      b: 4, // 2 * 2
      c: 6, // 3 * 2
    })
  })

  it('should handle empty async batch', async () => {
    class EmptyTestAsyncBatchFlow extends AsyncBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {},
    }

    const flow = new EmptyTestAsyncBatchFlow(new AsyncDataProcessNode())
    await flow.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'] || {}, {})
  })

  it('should handle async error handling', async () => {
    class ErrorTestAsyncBatchFlow extends AsyncBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        normal_key: 1,
        error_key: 2,
        another_key: 3,
      },
    }

    const flow = new ErrorTestAsyncBatchFlow(new AsyncErrorNode())

    await assert.rejects(() => flow.runAsync(sharedStorage), Error)
  })

  it('should handle nested async flow', async () => {
    class AsyncInnerNode extends AsyncNode {
      async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
        const key = this.params['key']
        if (!sharedStorage['intermediate_results']) {
          sharedStorage['intermediate_results'] = {}
        }
        sharedStorage['intermediate_results'][key] = sharedStorage['input_data'][key] + 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'next'
      }
    }

    class AsyncOuterNode extends AsyncNode {
      async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
        const key = this.params['key']
        if (!sharedStorage['results']) {
          sharedStorage['results'] = {}
        }
        sharedStorage['results'][key] = sharedStorage['intermediate_results'][key] * 2
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'done'
      }
    }

    class NestedAsyncBatchFlow extends AsyncBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        x: 1,
        y: 2,
      },
    }

    const innerNode = new AsyncInnerNode()
    const outerNode = new AsyncOuterNode()
    innerNode.minus('next').rshift(outerNode)

    const flow = new NestedAsyncBatchFlow(innerNode)
    await flow.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      x: 4, // (1 + 1) * 2
      y: 6, // (2 + 1) * 2
    })
  })

  it('should handle custom async parameters', async () => {
    class CustomParamAsyncNode extends AsyncNode {
      async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
        const key = this.params['key']
        const multiplier = this.params['multiplier'] || 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        if (!sharedStorage['results']) {
          sharedStorage['results'] = {}
        }
        sharedStorage['results'][key] = sharedStorage['input_data'][key] * multiplier
        return 'done'
      }
    }

    class CustomParamAsyncBatchFlow extends AsyncBatchFlow {
      async prepAsync(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k, i) => ({
          key: k,
          multiplier: i + 1,
        }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        a: 1,
        b: 2,
        c: 3,
      },
    }

    const flow = new CustomParamAsyncBatchFlow(new CustomParamAsyncNode())
    await flow.runAsync(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      a: 1 * 1, // first item, multiplier = 1
      b: 2 * 2, // second item, multiplier = 2
      c: 3 * 3, // third item, multiplier = 3
    })
  })
})
