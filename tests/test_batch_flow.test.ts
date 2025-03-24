import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { BatchFlow, Node } from '../pocketflow/index'

class DataProcessNode extends Node {
  prep(sharedStorage: Record<string, any>) {
    const key = this.params['key']
    const data = sharedStorage['input_data'][key]
    if (!sharedStorage['results']) {
      sharedStorage['results'] = {}
    }
    sharedStorage['results'][key] = data * 2
  }
}

class ErrorProcessNode extends Node {
  prep(sharedStorage: Record<string, any>) {
    const key = this.params['key']
    if (key === 'error_key') {
      throw new Error(`Error processing key: ${key}`)
    }
    if (!sharedStorage['results']) {
      sharedStorage['results'] = {}
    }
    sharedStorage['results'][key] = true
  }
}

describe('BatchFlow Tests', () => {
  it('should handle basic batch processing', () => {
    class SimpleTestBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
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

    const flow = new SimpleTestBatchFlow(new DataProcessNode())
    flow.run(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      a: 2,
      b: 4,
      c: 6,
    })
  })

  it('should handle empty input', () => {
    class EmptyTestBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {},
    }

    const flow = new EmptyTestBatchFlow(new DataProcessNode())
    flow.run(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'] || {}, {})
  })

  it('should handle single item', () => {
    class SingleItemBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        single: 5,
      },
    }

    const flow = new SingleItemBatchFlow(new DataProcessNode())
    flow.run(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      single: 10,
    })
  })

  it('should handle error handling', () => {
    class ErrorTestBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
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

    const flow = new ErrorTestBatchFlow(new ErrorProcessNode())

    assert.throws(() => flow.run(sharedStorage), Error)
  })

  it('should handle nested flow', () => {
    class InnerNode extends Node {
      exec(prepResult: any) {
        const key = this.params['key']
        if (!sharedStorage['intermediate_results']) {
          sharedStorage['intermediate_results'] = {}
        }
        sharedStorage['intermediate_results'][key] = sharedStorage['input_data'][key] + 1
      }
    }

    class OuterNode extends Node {
      exec(prepResult: any) {
        const key = this.params['key']
        if (!sharedStorage['results']) {
          sharedStorage['results'] = {}
        }
        sharedStorage['results'][key] = sharedStorage['intermediate_results'][key] * 2
      }
    }

    class NestedBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
        return Object.keys(sharedStorage['input_data']).map((k) => ({ key: k }))
      }
    }

    const sharedStorage: Record<string, any> = {
      input_data: {
        x: 1,
        y: 2,
      },
    }

    const innerNode = new InnerNode()
    const outerNode = new OuterNode()
    innerNode.rshift(outerNode)

    const flow = new NestedBatchFlow(innerNode)
    flow.run(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      x: 4, // (1 + 1) * 2
      y: 6, // (2 + 1) * 2
    })
  })

  it('should handle custom parameters', () => {
    class CustomParamNode extends Node {
      exec(prepResult: any) {
        const key = this.params['key']
        const multiplier = this.params['multiplier'] || 1
        if (!sharedStorage['results']) {
          sharedStorage['results'] = {}
        }
        sharedStorage['results'][key] = sharedStorage['input_data'][key] * multiplier
      }
    }

    class CustomParamBatchFlow extends BatchFlow {
      prep(sharedStorage: Record<string, any>) {
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

    const flow = new CustomParamBatchFlow(new CustomParamNode())
    flow.run(sharedStorage)

    assert.deepStrictEqual(sharedStorage['results'], {
      a: 1 * 1, // first item, multiplier = 1
      b: 2 * 2, // second item, multiplier = 2
      c: 3 * 3, // third item, multiplier = 3
    })
  })
})
