import { BaseNode } from './base-node'

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
