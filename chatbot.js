import Groq from "groq-sdk";
import { tavily } from '@tavily/core';
import NodeCache from "node-cache";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });

const cache = new NodeCache({ stdTTL: 60 * 60 * 24 });
const MAX_RETRIES = 10;
export let baseMessages = [
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
            A: The capital of France is Paris.

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
    let count = 0;
    let messages = cache.get(threadId) ?? baseMessages;
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
            return chatCompletion.choices[0]?.message.content?.trim();
        }

        for (const tool of toolCalls) {
            const functionName = tool.function.name;
            const params = typeof tool.function.arguments === "string"
                ? JSON.parse(tool.function.arguments)
                : tool.function.arguments;

            if (functionName === 'webSearch') {
                const toolResult = await searchWeb(params);
                messages.push({
                    tool_call_id: tool.id,
                    role: 'tool',
                    name: functionName,
                    content: toolResult
                });
                cache.set(threadId, messages);
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

async function searchWeb({ query }) {
    console.log("Calling web Search...");
    try {
        const response = await tvly.search(query);
        if (!response?.results?.length) return "No relevant information found online.";
        return response.results.map(r => r.content).join('\n\n');
    } catch (err) {
        console.error("Web search failed:", err);
        return "Sorry, I couldn’t fetch live data right now.";
    }
}