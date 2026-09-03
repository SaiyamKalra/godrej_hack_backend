const OLLAMA_BASE_URL=process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL=process.env.OLLAMA_MODEL || "llama3.2:latest";

interface OllamaMessage{
    role: "assistant" | "user" | "system";
    content:string;
}

interface OllamaResponse{
    message?:{
        role:string;
        content:string;
    }
}
export async function generateResponse(
    messages:OllamaMessage[]
): Promise<string> {
    const response=await fetch(`${OLLAMA_BASE_URL}/api/chat`,{
        method:"POST",
        headers:{
            "Content-Type":"application/json",
        },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            messages,
            stream: false,
        }),
    });

    if(!response.ok){
        const errorText=await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data: OllamaResponse = await response.json();
    if (!data.message?.content) {
        throw new Error("Ollama returned an empty response");
    }

    return data.message.content;
}