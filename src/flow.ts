import { BaseNode } from './base-node'
import { Node } from './node'

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
