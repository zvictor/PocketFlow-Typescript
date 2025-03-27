import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Node, SequentialBatchNode } from '../pocketflow/index'

class TestProcessingNode extends Node {
  async exec(item: any) {
    const { key, value } = item
    await new Promise((resolve) => setTimeout(resolve, 5)) // Simulate async work
    return { [key]: value * 2 }
  }
}

class ErrorNode extends Node {
  async exec(item: any) {
    if (item.shouldFail) {
      throw new Error(`Failed processing ${item.key}`)
    }
    return { [item.key]: item.value }
  }
}

class StatefulNode extends Node {
  private count = 0

  async exec(item: any) {
    this.count++
    return { [item.key]: item.value + this.count }
  }
}

describe('SequentialBatchNode Tests', () => {
  it('should process items in order', async () => {
    const processedOrder: string[] = []
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]

    const node = new SequentialBatchNode(1)
    node.exec = async (item: any) => {
      processedOrder.push(item.key)
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { [item.key]: item.value * 2 }
    }

    await (node as any)._exec(testItems)
    assert.deepStrictEqual(processedOrder, ['a', 'b', 'c'])
  })

  it('should maintain state between items', async () => {
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2 },
      { key: 'c', value: 3 },
    ]

    const statefulNode = new StatefulNode()
    const node = new SequentialBatchNode(1)
    node.exec = statefulNode.exec.bind(statefulNode)

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.deepStrictEqual(combined, {
      a: 2, // 1 + 1
      b: 4, // 2 + 2
      c: 6, // 3 + 3
    })
  })

  it('should handle async dependencies between items', async () => {
    const testItems = [
      { id: 'a', dependsOn: null, value: 1 },
      { id: 'b', dependsOn: 'a', value: 2 },
      { id: 'c', dependsOn: 'b', value: 3 },
    ]

    const context: Record<string, number> = {}
    const node = new SequentialBatchNode(1)
    node.exec = async (item: any) => {
      if (item.dependsOn) {
        assert(context[item.dependsOn], `Missing dependency ${item.dependsOn}`)
      }
      const result = item.value * 2
      context[item.id] = result
      return { [item.id]: result }
    }

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.deepStrictEqual(combined, { a: 2, b: 4, c: 6 })
  })

  it('should handle mixed success/error items', async () => {
    const testItems = [
      { id: 'a', shouldFail: false, value: 1 },
      { id: 'b', shouldFail: true, value: 2 },
      { id: 'c', shouldFail: false, value: 3 },
    ]

    const node = new SequentialBatchNode(1)
    node.exec = async (item: any) => {
      if (item.shouldFail) {
        throw new Error(`Failed processing ${item.id}`)
      }
      return { [item.id]: item.value * 2 }
    }

    await assert.rejects(() => (node as any)._exec(testItems))
  })

  it('should handle empty input', async () => {
    const node = new SequentialBatchNode(1)
    const processingNode = new TestProcessingNode()
    node.exec = processingNode.exec.bind(processingNode)

    const results = await (node as any)._exec([])
    assert.deepStrictEqual(results, [])
  })

  it('should stop on first error', async () => {
    const processedItems: string[] = []
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2, shouldFail: true },
      { key: 'c', value: 3 },
    ]

    const node = new SequentialBatchNode(1)
    const errorNode = new ErrorNode()
    node.exec = async (item: any) => {
      processedItems.push(item.key)
      return errorNode.exec(item)
    }

    await assert.rejects(() => (node as any)._exec(testItems))
    assert.deepStrictEqual(processedItems, ['a', 'b'])
  })

  it('should allow recovery from errors with fallback', async () => {
    const testItems = [
      { key: 'a', value: 1 },
      { key: 'b', value: 2, shouldFail: true, recoverable: true },
      { key: 'c', value: 3 },
    ]

    class RecoverableErrorNode extends Node {
      async exec(item: any) {
        if (item.shouldFail) {
          throw new Error('Failed processing')
        }
        return { [item.key]: item.value }
      }

      async execFallback(item: any) {
        if (item.recoverable) {
          return { [item.key]: 'recovered' }
        }
        throw new Error('Unrecoverable error')
      }
    }

    const node = new SequentialBatchNode(1)
    const errorNode = new RecoverableErrorNode()
    node.exec = errorNode.exec.bind(errorNode)
    node.execFallback = errorNode.execFallback.bind(errorNode)

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.deepStrictEqual(combined, {
      a: 1,
      b: 'recovered',
      c: 3,
    })
  })

  it('should handle retries', async () => {
    let attempts = 0
    const testItems = [{ key: 'a', value: 1, shouldFail: true }]

    const node = new SequentialBatchNode(3) // 3 retries
    node.exec = async (item: any) => {
      attempts++
      if (attempts < 3) {
        throw new Error('Simulated failure')
      }
      return { [item.key]: item.value }
    }

    await (node as any)._exec(testItems)
    assert.strictEqual(attempts, 3)
  })

  it('should handle complex transformations', async () => {
    const testItems = [
      { id: 1, data: { values: [1, 2, 3] } },
      { id: 2, data: { values: [4, 5] } },
    ]

    const node = new SequentialBatchNode(1)
    node.exec = async (item: any) => {
      const sum = item.data.values.reduce((a: number, b: number) => a + b, 0)
      return {
        [`result_${item.id}`]: {
          sum,
          count: item.data.values.length,
        },
      }
    }

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.strictEqual(combined.result_1.sum, 6)
    assert.strictEqual(combined.result_2.sum, 9)
    assert.strictEqual(combined.result_1.count, 3)
    assert.strictEqual(combined.result_2.count, 2)
  })

  it('should handle async dependencies between items', async () => {
    const testItems = [
      { id: 'a', dependsOn: null, value: 1 },
      { id: 'b', dependsOn: 'a', value: 2 },
      { id: 'c', dependsOn: 'b', value: 3 },
    ]

    const context: Record<string, number> = {}
    const node = new SequentialBatchNode(1)
    node.exec = async (item: any) => {
      if (item.dependsOn) {
        assert(context[item.dependsOn], `Missing dependency ${item.dependsOn}`)
      }
      const result = item.value * 2
      context[item.id] = result
      return { [item.id]: result }
    }

    const results = await (node as any)._exec(testItems)
    const combined = Object.assign({}, ...results)
    assert.deepStrictEqual(combined, { a: 2, b: 4, c: 6 })
  })
})
