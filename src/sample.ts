import { Flow, Node } from '.'

class ReadTarget extends Node {
  async _prep(shared: any): Promise<any> {
    return shared
  }

  async _exec(prepRes: any): Promise<any> {
    return prepRes
  }

  async _post(shared: any, prepRes: any, execRes: any): Promise<any> {
    return execRes
  }
}

const ApplyChanges = ReadTarget
const AnalyzePlan = ReadTarget
const MainDecisionAgent = ReadTarget
const ReadFileAction = ReadTarget
const GrepSearchAction = ReadTarget
const ListDirAction = ReadTarget
const DeleteFileAction = ReadTarget
const FormatResponseNode = ReadTarget

function createEditAgent() {
  const createEditAgentFlow = new Flow()
  const readTarget = new ReadTarget()
  const analyzePlan = new AnalyzePlan()
  const applyChanges = new ApplyChanges()

  createEditAgentFlow.next(readTarget).next(analyzePlan).next(applyChanges)

  return createEditAgentFlow
}

function createMainFlow() {
  const mainAgent = new MainDecisionAgent()
  const readFileAction = new ReadFileAction()
  const grepSearchAction = new GrepSearchAction()
  const listDirAction = new ListDirAction()
  const deleteFileAction = new DeleteFileAction()
  const formatResponseNode = new FormatResponseNode()
  const editAgent = createEditAgent()
  const mainFlow = new Flow()

  mainFlow
    .next(mainAgent)
    .on('read_file', readFileAction)
    .on('grep_search', grepSearchAction)
    .on('list_dir', listDirAction)
    .on('delete_file', deleteFileAction)
    .on('finish', formatResponseNode)
    .on('edit_file', editAgent)

  readFileAction.next(mainAgent)
  grepSearchAction.next(mainAgent)
  listDirAction.next(mainAgent)
  deleteFileAction.next(mainAgent)
  formatResponseNode.next(mainAgent)
  editAgent.next(mainAgent)

  return mainFlow
}

const mainFlow = createMainFlow()
