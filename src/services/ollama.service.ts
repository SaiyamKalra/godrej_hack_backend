const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://localhost:11434";

const OLLAMA_MODEL =
  process.env.OLLAMA_MODEL || "llama3.2:latest";

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
}

export async function generateChatTitle(conversationSnippet: string): Promise<string> {
  try{
    const prompt=`Summarize the following conversation into a concise 3 to 5 word topic title.
      Do NOT use quotation marks, punctuation, or conversational filler like "Here is the title".
      Output ONLY the clean title text.

      Conversation:
      "${conversationSnippet}"`;

     const res=await fetch(`${OLLAMA_BASE_URL}/api/generate`,{
      method:'POST',
      headers:{
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        think: false,
        options: {
          num_predict: 20,
        },
      }),
     });

     if(!res.ok){
      throw new Error("Ollama title generation error");
     }

     const data=(await res.json()) as OllamaGenerateResponse;

     const title = data.response
      .trim()
      .replace(/^["']|["']$/g, "")
      .replace(/\.$/, "");

    return title || conversationSnippet.substring(0, 100);
  }
  catch(err){
    console.error("Failed to generate AI title:", err);
    return conversationSnippet.substring(0, 100);
  }
}