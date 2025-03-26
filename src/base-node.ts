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
