import Groq from "groq-sdk";
import { tavily } from '@tavily/core';
import NodeCache from "node-cache";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });
const MAX_RETRIES = 10;
let count = 0;

export let messages = [
    {
        role: "system",
        content: `You are smart personal assistant.
            If you the answer to a question, answer it directly in plain English.
            If the answer required real-time, local, or up-to-date information, or if you don't know the answer, use the available tools to find it.
            You have access to the following tool:

            searchWeb(query: string): Use this to search the internet for current or unknow information.

            Decide when to use your own knowledge and when to use the tool.
            Do not mention the tool unless needed.

            Example:
            Q: What is the capital of France?
            A: The capital of Framnce is Parsis.

            Q: What's the weather in Mumbai right now?
            A: (use the search tool to find the latest weather)

            Q: Who is the Prime Minister of India?
            A: The current Prime Minister of India is Narendra Modi.

            Q: Tell me the latest IT news.
            A: (use the Search tool to get the latest news)

            current date and time: ${new Date().toUTCString()}`,
    }
];

export async function generate(userMessage, threadId) {
    messages = cache.get(threadId) ?? messages;
    messages.push({
        role: 'user',
        content: userMessage
    });
    while (true) {
        if (count > MAX_RETRIES) {
            return 'I Could not find the result. Retry again later';
        }
        count++;
        const chatCompletion = await getGroqChatCompletion(messages);
        messages.push(chatCompletion.choices[0]?.message);
        // Print the completion returned by the LLM.
        const toolCalls = chatCompletion.choices[0]?.message.tool_calls;
        if (!toolCalls) {
            cache.set(threadId, messages);
            console.log("messages:", messages);
            return chatCompletion.choices[0]?.message.content;
        }

        for (const tool of toolCalls) {
            const functionName = tool.function.name;
            const functionParams = tool.function.arguments;

            if (functionName === 'webSearch') {
                const toolResult = await webSearch(JSON.parse(functionParams));
                // console.log('Tool Result: ', toolResult);
                messages.push({
                    tool_call_id: tool.id,
                    role: 'tool',
                    name: functionName,
                    content: toolResult
                })
            }
        }
    }
}

export async function getGroqChatCompletion(messages) {
    return groq.chat.completions.create({
        temperature: 0,
        model: "llama-3.3-70b-versatile",
        messages: messages,
        tools: [
            {
                "type": "function",
                "function": {
                    "name": "webSearch",
                    "description": "Search the latest information and real time data on the internet",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to perform search on."
                            }
                        },
                        "required": ["query"]
                    }
                }
            }
        ],
        tool_choice: "auto"
    });
}

async function webSearch({ query }) {
    console.log("Calling web Search...");
    const response = await tvly.search(query);
    const finalResult = response.results.map((item) => item.content).join('\n\n');
    return finalResult;
}