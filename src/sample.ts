import { Flow } from './flow'
import { Node } from './node'

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
    .nextIf('read_file', readFileAction)
    .nextIf('grep_search', grepSearchAction)
    .nextIf('list_dir', listDirAction)
    .nextIf('delete_file', deleteFileAction)
    .nextIf('finish', formatResponseNode)
    .nextIf('edit_file', editAgent)

  readFileAction.next(mainAgent)
  grepSearchAction.next(mainAgent)
  listDirAction.next(mainAgent)
  deleteFileAction.next(mainAgent)
  formatResponseNode.next(mainAgent)
  editAgent.next(mainAgent)

  return mainFlow
}

const mainFlow = createMainFlow()
