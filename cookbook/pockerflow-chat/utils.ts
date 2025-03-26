import OpenAI from 'openai'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function callLLM(messages: Message[]) {
 const client = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY
 })

 const response = await client.chat.completions.create({
   model: 'gpt-4o-mini',
   messages: messages,
   temperature: 0.7
 })

 return response.choices[0].message.content
}
