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

class CheckPositiveNode extends Node {
  async post(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    return sharedStorage['current'] >= 0 ? 'positive' : 'negative'
  }
}

class NoOpNode extends Node {
  async prep(sharedStorage: Record<string, any>) {
    // Do nothing just pass
    return null
  }
}

describe('Flow Basic Tests', () => {
  it('should handle single number node', async () => {
    const sharedStorage: Record<string, any> = {}
    const start = new NumberNode(5)
    const pipeline = new Flow(start)
    await pipeline.run(sharedStorage)
    assert.strictEqual(sharedStorage['current'], 5)
  })

  it('should handle sequence of operations', async () => {
    const sharedStorage: Record<string, any> = {}
    const n1 = new NumberNode(5)
    const n2 = new AddNode(3)
    const n3 = new MultiplyNode(2)

    // Chain them in sequence using next()
    n1.next(n2).next(n3)

    const pipeline = new Flow(n1)
    await pipeline.run(sharedStorage)
    assert.strictEqual(sharedStorage['current'], 16)
  })

  it('should handle branching with positive route', async () => {
    const sharedStorage: Record<string, any> = {}
    const start = new NumberNode(5)
    const check = new CheckPositiveNode()
    const addIfPositive = new AddNode(10)
    const addIfNegative = new AddNode(-20)

    start.next(check)

    // Use on() for conditional transitions
    check.on('positive', addIfPositive)
    check.on('negative', addIfNegative)

    const pipeline = new Flow(start)
    await pipeline.run(sharedStorage)
    assert.strictEqual(sharedStorage['current'], 15)
  })

  it('should handle negative branch', async () => {
    const sharedStorage: Record<string, any> = {}
    const start = new NumberNode(-5)
    const check = new CheckPositiveNode()
    const addIfPositive = new AddNode(10)
    const addIfNegative = new AddNode(-20)

    // Build the flow
    start.next(check)
    check.on('positive', addIfPositive)
    check.on('negative', addIfNegative)

    const pipeline = new Flow(start)
    await pipeline.run(sharedStorage)
    assert.strictEqual(sharedStorage['current'], -25)
  })

  it('should handle cycle until negative', async () => {
    const sharedStorage: Record<string, any> = {}
    const n1 = new NumberNode(10)
    const check = new CheckPositiveNode()
    const subtract3 = new AddNode(-3)
    const noOp = new NoOpNode() // Dummy node for the 'negative' branch

    // Build the cycle:
    //   n1 -> check -> if 'positive': subtract3 -> back to check
    n1.next(check)
    check.on('positive', subtract3)
    subtract3.next(check)

    // Attach a no-op node on the negative branch to avoid warning
    check.on('negative', noOp)

    const pipeline = new Flow(n1)
    await pipeline.run(sharedStorage)

    // final result should be -2: (10 -> 7 -> 4 -> 1 -> -2)
    assert.strictEqual(sharedStorage['current'], -2)
  })
})
