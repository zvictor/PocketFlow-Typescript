import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  Node,
  Flow,
  BaseNode,
} from '../pocketflow/index';

// Test Node implementations
class NumberNode extends Node {
  constructor(private number: number) {
    super();
  }

  prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] = this.number;
  }
}

class AddNode extends Node {
  constructor(private number: number) {
    super();
  }

  prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] += this.number;
  }
}

class MultiplyNode extends Node {
  constructor(private number: number) {
    super();
  }


  prep(sharedStorage: Record<string, any>) {
    sharedStorage['current'] *= this.number;
  }
}

class CheckPositiveNode extends Node {
  post(sharedStorage: Record<string, any>, prepResult: any, procResult: any) {
    return sharedStorage['current'] >= 0 ? 'positive' : 'negative';
  }
}

class NoOpNode extends Node {
  prep(sharedStorage: Record<string, any>) {
    // Do nothing, just pass
  }
}

describe('Flow Basic Tests', () => {
  it('should handle single number node', () => {
    const sharedStorage: Record<string, any> = {};
    const start = new NumberNode(5);
    const pipeline = new Flow(start);
    pipeline.run(sharedStorage);
    assert.strictEqual(sharedStorage['current'], 5);
  });

  it('should handle sequence of operations', () => {
    const sharedStorage: Record<string, any> = {};
    const n1 = new NumberNode(5);
    const n2 = new AddNode(3);
    const n3 = new MultiplyNode(2);

    // Chain them in sequence using the >> operator
    n1.rshift(n2).rshift(n3);

    const pipeline = new Flow(n1);
    pipeline.run(sharedStorage);
    assert.strictEqual(sharedStorage['current'], 16);
  });

  it('should handle branching with positive route', () => {
    const sharedStorage: Record<string, any> = {};
    const start = new NumberNode(5);
    const check = new CheckPositiveNode();
    const addIfPositive = new AddNode(10);
    const addIfNegative = new AddNode(-20);

    start.rshift(check);

    // Use the minus operator for condition
    check.minus('positive').rshift(addIfPositive);
    check.minus('negative').rshift(addIfNegative);

    const pipeline = new Flow(start);
    pipeline.run(sharedStorage);
    assert.strictEqual(sharedStorage['current'], 15);
  });

  it('should handle negative branch', () => {
    const sharedStorage: Record<string, any> = {};
    const start = new NumberNode(-5);
    const check = new CheckPositiveNode();
    const addIfPositive = new AddNode(10);
    const addIfNegative = new AddNode(-20);

    // Build the flow
    start.rshift(check);
    check.minus('positive').rshift(addIfPositive);
    check.minus('negative').rshift(addIfNegative);

    const pipeline = new Flow(start);
    pipeline.run(sharedStorage);
    assert.strictEqual(sharedStorage['current'], -25);
  });

  it('should handle cycle until negative', () => {
    const sharedStorage: Record<string, any> = {};
    const n1 = new NumberNode(10);
    const check = new CheckPositiveNode();
    const subtract3 = new AddNode(-3);
    const noOp = new NoOpNode();  // Dummy node for the 'negative' branch

    // Build the cycle:
    //   n1 -> check -> if 'positive': subtract3 -> back to check
    n1.rshift(check);
    check.minus('positive').rshift(subtract3);
    subtract3.rshift(check);
    
    // Attach a no-op node on the negative branch to avoid warning
    check.minus('negative').rshift(noOp);

    const pipeline = new Flow(n1);
    pipeline.run(sharedStorage);

    // final result should be -2: (10 -> 7 -> 4 -> 1 -> -2)
    assert.strictEqual(sharedStorage['current'], -2);
  });
});
