import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AsyncFlow, AsyncNode } from '../pocketflow/index'

class AsyncNumberNode extends AsyncNode {
  constructor(private number: number) {
    super()
  }

  async prepAsync(sharedStorage: Record<string, any>) {
    sharedStorage['current'] = this.number
    return 'set_number'
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return 'number_set'
  }
}

class AsyncIncrementNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    sharedStorage['current'] = (sharedStorage['current'] || 0) + 1
    return 'incremented'
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return 'done'
  }
}

class BranchingAsyncNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    const value = sharedStorage['value'] || 0
    sharedStorage['value'] = value
    return null
  }

  async postAsync(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    await new Promise((resolve) => setTimeout(resolve, 10))
    return sharedStorage['value'] >= 0 ? 'positive_branch' : 'negative_branch'
  }
}

class PositiveNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    sharedStorage['path'] = 'positive'
    return null
  }
}

class NegativeNode extends AsyncNode {
  async prepAsync(sharedStorage: Record<string, any>) {
    sharedStorage['path'] = 'negative'
    return null
  }
}

describe('AsyncFlow Tests', () => {
  it('should handle simple async flow', async () => {
    const sharedStorage: Record<string, any> = {}

    const start = new AsyncNumberNode(5)
    const incNode = new AsyncIncrementNode()
    start.minus('number_set').rshift(incNode)

    const flow = new AsyncFlow(start)
    await flow.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 6)
  })

  it('should handle async flow branching', async () => {
    const sharedStorage: Record<string, any> = {
      value: 10,
    }

    const start = new BranchingAsyncNode()
    const positiveNode = new PositiveNode()
    const negativeNode = new NegativeNode()

    start.minus('positive_branch').rshift(positiveNode)
    start.minus('negative_branch').rshift(negativeNode)

    const flow = new AsyncFlow(start)
    await flow.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['path'], 'positive')
  })

  it('should handle negative branch', async () => {
    const sharedStorage: Record<string, any> = {
      value: -5,
    }

    const start = new BranchingAsyncNode()
    const positiveNode = new PositiveNode()
    const negativeNode = new NegativeNode()

    start.minus('positive_branch').rshift(positiveNode)
    start.minus('negative_branch').rshift(negativeNode)

    const flow = new AsyncFlow(start)
    await flow.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['path'], 'negative')
  })

  it('should handle direct node call', async () => {
    const sharedStorage: Record<string, any> = {}

    const node = new AsyncNumberNode(42)
    const condition = await node.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 42)
    assert.strictEqual(condition, 'number_set')
  })

  it('should handle direct increment call', async () => {
    const sharedStorage: Record<string, any> = {
      current: 10,
    }

    const node = new AsyncIncrementNode()
    const condition = await node.runAsync(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 11)
    assert.strictEqual(condition, 'done')
  })
})
