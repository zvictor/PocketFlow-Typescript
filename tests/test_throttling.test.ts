import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import pLimit from 'p-limit'
import { Node, ParallelBatchNode } from '../pocketflow/index'

describe('Throttling Tests', () => {
  it('should respect concurrency limits with p-limit', async () => {
    const concurrency = 2
    const limit = pLimit(concurrency)
    let maxConcurrent = 0
    let current = 0
    const activeTasks = new Set<number>()

    class LimitedNode extends ParallelBatchNode {
      async exec(item: any) {
        return limit(async () => {
          current++
          maxConcurrent = Math.max(maxConcurrent, current)
          activeTasks.add(item.value)
          assert.strictEqual(current <= concurrency, true, 'Should not exceed concurrency limit')

          await new Promise((resolve) => setTimeout(resolve, 10))

          current--
          activeTasks.delete(item.value)
          return { [item.key]: item.value * 2 }
        })
      }
    }

    const testItems = Array.from({ length: 10 }, (_, i) => ({
      key: `item_${i}`,
      value: i,
    }))

    const node = new LimitedNode()
    const results = await (node as any)._exec(testItems)

    // Verify concurrency was respected
    assert.strictEqual(maxConcurrent, concurrency)

    // Verify all tasks completed
    assert.strictEqual(results.length, testItems.length)

    // Verify correct results
    results.forEach((result: any, i: number) => {
      const expectedKey = `item_${i}`
      const expectedValue = i * 2
      assert.strictEqual(result[expectedKey], expectedValue)
    })

    // Verify no tasks left running
    assert.strictEqual(current, 0)
    assert.strictEqual(activeTasks.size, 0)
  })
})
