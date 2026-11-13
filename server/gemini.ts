import { GoogleGenAI } from '@google/genai';

export const ALLOWED_CHAT_MODELS = [
  'gemini-4-hydrogen',
  'gemini-4-carbon',
  'gemini-4-argon',
  'gemini-3.1-flash-lite',
] as const;

export type AllowedChatModel = (typeof ALLOWED_CHAT_MODELS)[number];

export const ROLE_SYSTEM_INSTRUCTIONS: Record<string, string> = {
  sre_commander:
    'You are the UPIShield SRE Incident Commander. Provide concise, actionable, bank-grade site reliability guidance grounded strictly in the provided live topology, incident, and recovery data. Never fabricate live bank production metrics; clearly note simulated/synthetic demonstration data when referencing historical records.',
  risk_analyst:
    'You are the UPIShield Chief Risk & Continuity Analyst. Explain predictive failure signals, seasonal October anomalies, blast radius exposure, and financial/transaction continuity impact with precision and regulatory clarity.',
  db_architect:
    'You are the UPIShield Database Reliability Architect. Focus on connection pool saturation, idempotency journal locks, synchronous WAL replication, read-replica offload, and failover safety.',
  payment_auditor:
    'You are the UPIShield Payment Integrity Auditor. Focus on idempotency key guarantees, duplicate debit prevention, response-loss reconciliation, and ISO-8583/UPI settlement state safety.',
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Select or configure a valid Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function runGeminiChat(params: {
  model: string;
  role: string;
  history: Array<{ role: 'user' | 'model'; text: string }>;
  message: string;
  platformContext: string;
}): Promise<{ reply: string; modelUsed: string }> {
  const ai = getAiClient();
  const modelUsed = (ALLOWED_CHAT_MODELS as readonly string[]).includes(params.model)
    ? params.model
    : 'gemini-4-hydrogen';

  const baseInstruction =
    ROLE_SYSTEM_INSTRUCTIONS[params.role] ?? ROLE_SYSTEM_INSTRUCTIONS.sre_commander;

  const systemInstruction = `${baseInstruction}\n\nCurrent UPIShield Demo Environment Telemetry Snapshot:\n${params.platformContext}`;

  const chat = ai.chats.create({
    model: modelUsed,
    config: {
      systemInstruction,
    },
    history: params.history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
  });

  const response = await chat.sendMessage({ message: params.message });
  return {
    reply: response.text ?? 'No response text generated.',
    modelUsed,
  };
}

export async function generateArchitectureImage(params: {
  prompt: string;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio: '16:9' | '4:3' | '1:1';
}): Promise<{ imageDataUrl: string; caption: string }> {
  const ai = getAiClient();
  const validSize = (['1K', '2K', '4K'] as const).includes(params.imageSize)
    ? params.imageSize
    : '1K';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
          text: params.prompt,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: params.aspectRatio || '16:9',
        imageSize: validSize,
      },
    },
  });

  let imageDataUrl = '';
  let caption = '';

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
    } else if (part.text) {
      caption += part.text;
    }
  }

  if (!imageDataUrl) {
    throw new Error('Image model did not return an image payload.');
  }

  return { imageDataUrl, caption: caption.trim() };
}
