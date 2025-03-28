type Action = string
type Params = Record<string, any>
type Successors = Record<Action, BaseNode>

const DEFAULT_ACTION = 'default'

export class BaseNode {
  params: Params = {}
  successors: Successors = {}
  curRetry = 0

  setParams(params: Params): this {
    this.params = params
    return this
  }

  next(node: BaseNode, action: Action = DEFAULT_ACTION): BaseNode {
    if (action in this.successors) {
      console.warn(`Overwriting successor for action '${action}'`)
    }
    this.successors[action] = node
    return node
  }

  on(action: string, node: BaseNode): BaseNode {
    return this.next(node, action)
  }

  async prep(shared: any): Promise<any> {}
  async exec(prepRes: any): Promise<any> {}
  async post(shared: any, prepRes: any, execRes: any): Promise<Action | void> {}

  protected async _exec(prepRes: any): Promise<any> {
    return this.exec(prepRes)
  }

  async _run(shared: any): Promise<any> {
    const p = await this.prep(shared)
    const e = await this._exec(p)
    return this.post(shared, p, e)
  }

  async run(shared: any): Promise<any> {
    if (Object.keys(this.successors).length > 0) {
      console.warn("Node won't run successors. Use Flow.")
    }
    return this._run(shared)
  }
}

export class Node extends BaseNode {
  constructor(
    public maxRetries = 1,
    public wait = 0,
  ) {
    super()
  }

  async execFallback(prepRes: any, exc: Error): Promise<any> {
    throw exc
  }

  protected async _exec(prepRes: any): Promise<any> {
    for (this.curRetry = 0; this.curRetry < this.maxRetries; this.curRetry++) {
      try {
        return await this.exec(prepRes)
      } catch (e) {
        if (this.curRetry === this.maxRetries - 1) {
          return await this.execFallback(prepRes, e as Error)
        }
        if (this.wait > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.wait * 1000))
        }
      }
    }
    return null
  }
}

export class SequentialBatchNode extends Node {
  protected async _exec(items: any[]): Promise<any[]> {
    if (!items || !items.length) return []
    const results: any[] = []
    for (const item of items) {
      results.push(await super._exec(item))
    }
    return results
  }
}

export class ParallelBatchNode extends Node {
  protected async _exec(items: any[]): Promise<any[]> {
    if (!items || !items.length) return []
    return Promise.all(items.map((item) => super._exec(item)))
  }
}

export class Flow extends BaseNode {
  constructor(public start: BaseNode) {
    super()
  }

  getNextNode(curr: BaseNode, action?: Action): BaseNode | null {
    const next = curr.successors[action || DEFAULT_ACTION]
    if (!next && Object.keys(curr.successors).length > 0) {
      console.warn(`Flow ends: '${action}' not found in ${Object.keys(curr.successors)}`)
    }
    return next || null
  }

  protected async _orch(shared: any, params?: Params): Promise<any> {
    let curr: BaseNode | null = this.start
    let p = { ...this.params, ...(params || {}) }
    let lastResult: any

    while (curr) {
      const node = Object.create(Object.getPrototypeOf(curr))
      Object.assign(node, curr)
      node.params = { ...curr.params }
      node.successors = { ...curr.successors }

      node.setParams(p)
      lastResult = await node._run(shared)
      curr = this.getNextNode(curr, lastResult)
    }

    return lastResult
  }

  async _run(shared: any): Promise<any> {
    const pr = await this.prep(shared)
    const result = await this._orch(shared)
    return this.post(shared, pr, result)
  }

  async exec(prepRes: any): Promise<never> {
    throw new Error("Flow can't exec.")
  }
}

export class SequentialBatchFlow extends Flow {
  async _run(shared: any): Promise<any> {
    const pr = (await this.prep(shared)) || []
    let result = null
    for (const bp of pr) {
      result = await this._orch(shared, { ...this.params, ...bp })
    }
    return this.post(shared, pr, result)
  }
}

export class ParallelBatchFlow extends Flow {
  async _run(shared: any): Promise<any> {
    const pr = (await this.prep(shared)) || []
    const results = await Promise.all(
      pr.map((bp: any) => this._orch(shared, { ...this.params, ...bp })),
    )
    const lastResult = results.length > 0 ? results[results.length - 1] : null
    return this.post(shared, pr, lastResult)
  }
}
