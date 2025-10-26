const askButton = document.querySelector('#ask_btn');
const userInput = document.querySelector('#user_input');
const chatContainer = document.querySelector('#chat_container');
const threadId = Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

userInput?.addEventListener('keyup', handleEnter);
askButton?.addEventListener('click', handleButton);

const loading = document.createElement('div');
loading.className = 'my-6 animate-pulse';
loading.textContent = 'Thinking...';


async function generate(text) {
    /*
        1. Append message to UI
        2. Send message to LLm
        3. Append response to UI
    */
    const msg = document.createElement('div');
    msg.className = 'my-6 bg-neutral-800 p-3 rounded-xl ml-auto max-w-fit'
    msg.textContent = text;
    chatContainer?.appendChild(msg);
    userInput.value = '';

    chatContainer.appendChild(loading);

    //Call Server
    const assistantMessage = await callServer(text);
    console.log("Assistant:", assistantMessage);

    const assistantMsgElem = document.createElement('div');
    assistantMsgElem.className = 'max-w-fit'
    assistantMsgElem.textContent = assistantMessage;
    loading.remove();
    chatContainer?.appendChild(assistantMsgElem);
}

async function handleButton(e) {
    const inputText = userInput?.value.trim();
    if (!inputText) return;
    await generate(inputText);
}

async function handleEnter(e) {
    if (e.key == 'Enter') {
        const inputText = userInput?.value.trim();
        if (!inputText) return;
        await generate(inputText);
    }
}


async function callServer(inputText) {
    const resp = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ message: inputText, threadId: threadId })
    });

    if (!resp.ok) {
        throw new Error("Error generating the response.")
    }

    const outputResult = await resp.json();
    return outputResult.message;

}

