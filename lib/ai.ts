// Force Build Update: 2024-05-04_1711
import { GoogleGenAI } from "@google/genai";

let genAIClient: GoogleGenAI | null = null;

export const getAI = () => {
  if (!genAIClient) {
    // Tenta várias fontes comuns no AI Studio
    const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const windowKey = typeof window !== 'undefined' ? (window as Window & { NEXT_PUBLIC_GEMINI_API_KEY?: string }).NEXT_PUBLIC_GEMINI_API_KEY : null;
    
    let apiKey = envKey || windowKey;

    console.log("Detectando Chave Gemini:", {
      hasEnv: !!envKey,
      hasWindow: !!windowKey,
      envStart: envKey ? envKey.substring(0, 4) : 'null',
      envLength: envKey ? envKey.length : 0
    });

    if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey.length < 10) {
      const errorMsg = `SISTEMA AI DESATIVADO: Chave de API Gemini não encontrada ou inválida. 
      Se estiver no Vercel, adicione a variável NEXT_PUBLIC_GEMINI_API_KEY.
      Se estiver no AI Studio, verifique os Secrets.`;
      console.error(errorMsg);
      // Não joga erro aqui para permitir que o app carregue a parte sem IA
      return null;
    }
    
    // Limpeza de possíveis espaços ou aspas residuais
    apiKey = apiKey.trim().replace(/^["']|["']$/g, '');
    
    const maskedKey = apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'null';
    console.log("Iniciando Gemini SDK com chave:", maskedKey);
    
    // Extrema limpeza
    if (apiKey.includes(" ") || apiKey.includes("\n") || apiKey.includes("\r")) {
      console.warn("ALERTA: A chave Gemini contém espaços ou quebras de linha invisíveis. Limpando...");
      apiKey = apiKey.replace(/\s/g, '');
    }
    
    try {
      genAIClient = new GoogleGenAI({ apiKey });
    } catch (e) {
      console.error("Erro crítico ao instanciar Gemini SDK:", e);
      return null;
    }
  }
  return genAIClient;
};
