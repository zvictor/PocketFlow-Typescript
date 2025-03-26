export abstract class BaseNode {
  params: Record<string, any> = {}
  successors: Record<string, BaseNode> = {}

  constructor() {}

  setParams(params: Record<string, any>) {
    this.params = params
  }

  getNextNode = (action?: string): BaseNode | null => {
    const next = this.successors[action || 'default']

    if (!next && Object.keys(this.successors).length > 0) {
      console.warn(`Flow ends: '${action}' not found in ${Object.keys(this.successors)}`)
    }
    return next || null
  }

  // return next node for chaining
  next = (node: BaseNode): BaseNode => {
    this.nextIf('default', node)
    return node
  }

  // return this for additional nextIf chaining
  nextIf = (action: string, node: BaseNode): BaseNode => {
    if (action in this.successors) {
      console.warn(`Overwriting successor for action '${action}'`)
    }
    this.successors[action] = node
    return this
  }

  clone(): typeof this {
    const clone = Object.create(Object.getPrototypeOf(this))
    Object.assign(clone, this)
    clone.params = { ...this.params }
    clone.successors = { ...this.successors }
    return clone
  }

  abstract run(shared: any, params?: Record<string, any>, lastFlowResult?: any): Promise<any>
}

export class Flow extends BaseNode {
  constructor() {
    super()
  }

  async run(shared: any, params?: Record<string, any>, lastFlowResult?: any): Promise<any> {
    let curr = this.getNextNode() as Flow | Node | null

    if (!curr) {
      throw new Error('Flow ends: no next node found')
    }

    let p = { ...(params || {}) }
    let lastResult = lastFlowResult

    while (curr) {
      const node = curr.clone()
      node.setParams(p)
      lastResult = await node.run(shared, p, lastResult)
      curr = curr.getNextNode(lastResult)
    }

    return lastResult
  }
}

export abstract class Node extends BaseNode {
  curRetry = 0

  constructor(
    public maxRetries = 1,
    public wait = 0,
  ) {
    super()
  }

  _execFallback(prepRes: any, exc: Error): any {
    throw exc
  }

  async exec(prepRes: any): Promise<any> {
    for (this.curRetry = 0; this.curRetry < this.maxRetries; this.curRetry++) {
      try {
        return await this._exec(prepRes)
      } catch (e) {
        if (this.curRetry === this.maxRetries - 1) {
          return this._execFallback(prepRes, e as Error)
        }
        if (this.wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.wait * 1000))
        }
      }
    }
    return null
  }

  async run(shared: any, params?: Record<string, any>, lastFlowResult?: any): Promise<any> {
    const p = await this._prep(shared)
    const e = await this.exec(p)
    return this._post(shared, p, e)
  }

  abstract _prep(shared: any): Promise<any>
  abstract _exec(prepRes: any): Promise<any>
  abstract _post(shared: any, prepRes: any, execRes: any): Promise<any>
}

export abstract class BatchNode extends Node {
  async exec(prepRes: any[]): Promise<any[]> {
    const results = []
    for (const item of prepRes) {
      results.push(await this._exec(item))
    }
    return results
  }
}

export abstract class ParallelBatchNode extends Node {
  async exec(prepRes: any[]): Promise<any[]> {
    return Promise.all(prepRes.map((p) => super.exec(p)))
  }
}
