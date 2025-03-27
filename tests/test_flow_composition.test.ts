import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Flow, Node } from '../pocketflow/index'

// Test Node implementations
class NumberNode extends Node {
  constructor(private number: number) {
    super()
  }

  async prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] = this.number
    return null
  }
}

class AddNode extends Node {
  constructor(private number: number) {
    super()
  }

  async prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] += this.number
    return null
  }
}

class MultiplyNode extends Node {
  constructor(private number: number) {
    super()
  }

  async prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] *= this.number
    return null
  }
}

describe('Flow Composition Tests', () => {
  it('should handle flow as node', async () => {
    const sharedStorage: Record<string, any> = {}

    // Inner flow f1
    const f1 = new Flow(new NumberNode(5))
    f1.start.next(new AddNode(10)).next(new MultiplyNode(2))

    // f2 starts with f1
    const f2 = new Flow(f1)

    // Wrapper flow f3 to ensure proper execution
    const f3 = new Flow(f2)
    await f3.run(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 30)
  })

  it('should handle nested flows', async () => {
    const sharedStorage: Record<string, any> = {}

    // Build the inner flow
    const innerFlow = new Flow(new NumberNode(5))
    innerFlow.start.next(new AddNode(3))

    // Build the middle flow whose start is the inner flow
    const middleFlow = new Flow(innerFlow)
    middleFlow.start.next(new MultiplyNode(4))

    // Wrapper flow to ensure proper execution
    const wrapperFlow = new Flow(middleFlow)
    await wrapperFlow.run(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 32)
  })

  it('should handle flow chaining', async () => {
    const sharedStorage: Record<string, any> = {}

    // flow1
    const numberNode = new NumberNode(10)
    const addNode = new AddNode(10)
    numberNode.next(addNode)
    const flow1 = new Flow(numberNode)

    // flow2
    const multiplyNode = new MultiplyNode(2)
    const flow2 = new Flow(multiplyNode)

    // Chain flow1 to flow2 by connecting the last node of flow1 to flow2
    addNode.next(flow2)

    // Wrapper flow to ensure proper execution
    const wrapperFlow = new Flow(flow1)
    await wrapperFlow.run(sharedStorage)

    assert.strictEqual(sharedStorage['current'], 40)
  })
})
