import readline from 'node:readline';
import { Node, Flow, AsyncNode, AsyncFlow } from "~/pocketflow";
import { Message, callLLM } from './utils';


function promptUser(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('You: ', (userInput) => {
      rl.close();
      resolve(userInput);
    });
  });
}

interface ChatSharedContext {
  messages?: Message[]
}

class ChatNode extends AsyncNode {
  async prepAsync(shared: ChatSharedContext) {
    if (!shared.messages) {
      shared.messages = []
      console.log("Welcome to the chat! Type 'exit' to end the conversation.")
    }

    const input = await promptUser()

    if (input === 'exit') {
      return
    }

    shared.messages.push({role: 'user', content: input})
    return shared.messages
  }

  async execAsync (messages?: Message[]) {
    if (!messages) {
      return
    }

    const response = await callLLM(messages)
    return response
  }

  async postAsync(shared: ChatSharedContext, prepRes?: Message[], execRes?: string) {
    if (!prepRes) {
      console.log("Goodbye!")
      return;
    }

    if (!execRes) {
      console.log("Goodbye!")
      return;
    }

    console.log(`Assistant: ${execRes}`)
    shared.messages?.push({role: 'assistant', content: execRes})
    return 'continue'
  }
}

const chatNode = new ChatNode()
chatNode.on('continue').next(chatNode)

const flow = new AsyncFlow(chatNode)

const shared: ChatSharedContext = {}
flow.runAsync(shared)
