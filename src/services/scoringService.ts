import { GoogleGenAI, Type } from "@google/genai";

// Initialize the Gemini API client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScoringResult {
  ta_tr_score: number;
  cc_score: number;
  lr_score: number;
  gra_score: number;
  ta_tr_feedback: string;
  cc_feedback: string;
  lr_feedback: string;
  gra_feedback: string;
  overall_score: number;
}

export const calculateOverallBand = (ta: number, cc: number, lr: number, gra: number): number => {
  const average = (ta + cc + lr + gra) / 4;
  const remainder = average % 1;
  const whole = Math.floor(average);
  
  if (remainder >= 0.75) {
    return whole + 1;
  } else if (remainder >= 0.25) {
    return whole + 0.5;
  } else {
    return whole;
  }
};

export const calculateFinalWritingScore = (task1Score: number, task2Score: number): number => {
  const rawScore = task1Score * 0.3 + task2Score * 0.7;
  const remainder = rawScore % 1;
  const whole = Math.floor(rawScore);
  
  if (remainder >= 0.75) {
    return whole + 1;
  } else if (remainder >= 0.25) {
    return whole + 0.5;
  } else {
    return whole;
  }
};

export interface DiagnosticAnnotation {
  range: [number, number];
  type: "Red" | "Blue" | "Yellow" | "Green";
  original: string;
  replacement: string;
  explanation_zh: string;
}

export interface ModelEssayResult {
  essay: string;
  targetScore: string;
  improvements: string[];
}

export const generateModelEssay = async (text: string, taskType: 'task1' | 'task2', currentScore: number): Promise<ModelEssayResult> => {
  let targetScoreStr = "";
  let focus = "";
  
  if (currentScore < 5.0) {
    targetScoreStr = "5.5";
    focus = "Focus on basic grammar, clear sentences, and word count.";
  } else if (currentScore < 7.5) {
    targetScoreStr = (currentScore + 1.0).toFixed(1);
    focus = "Focus on academic vocabulary (LR) and cohesive devices (CC).";
  } else {
    targetScoreStr = "8.5-9.0";
    focus = "Focus on precision, native collocations, and deep logic.";
  }

  const taskName = taskType === 'task1' ? 'Task 1' : 'Task 2';
  const minWords = taskType === 'task1' ? 150 : 250;

  const prompt = `
You are an IELTS examiner. The student's ${taskName} essay scored Band ${currentScore.toFixed(1)}.
Rewrite it to Band ${targetScoreStr}.

CONSTRAINTS:
1. Keep the original position/arguments.
2. Min ${minWords} words.
3. ${focus}
4. Highlight upgraded words in **bold**.

OUTPUT FORMAT (JSON):
{
  "essay": "Rewritten essay with **bold** highlights.",
  "targetScore": "${targetScoreStr}",
  "improvements": ["Action 1 (Chinese)", "Action 2 (Chinese)", "Action 3 (Chinese)"]
}

Original Essay:
"""
${text}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            essay: { type: Type.STRING },
            targetScore: { type: Type.STRING },
            improvements: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["essay", "targetScore", "improvements"]
        }
      }
    });

    if (!response.text) throw new Error("Failed to generate model essay.");
    return JSON.parse(response.text) as ModelEssayResult;
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error(JSON.stringify({ type: 'RATE_LIMIT', retryDelay: 15 }));
    }
    throw error;
  }
};

export const generateDiagnostics = async (text: string): Promise<DiagnosticAnnotation[]> => {
  const prompt = `
You are an IELTS examiner. Diagnose this essay sentence-by-sentence.

Categories:
- "Red": Critical Errors (Grammar, Spelling) -> GRA
- "Blue": Lexical Upgrades (Academic Words, Collocation) -> LR
- "Yellow": Logic & Coherence (Referencing, Connectors) -> CC/TR
- "Green": Positive Feedback (Praise)

OUTPUT FORMAT (JSON Array):
[{
  "range": [start_index, end_index],
  "type": "Red" | "Blue" | "Yellow" | "Green",
  "original": "Original text",
  "replacement": "Correction/Upgrade",
  "explanation_zh": "Chinese explanation linking to band score (e.g., '此修改助你达到 GRA 6分')."
}]

Essay:
"""
${text}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              range: { type: Type.ARRAY, items: { type: Type.INTEGER } },
              type: { type: Type.STRING },
              original: { type: Type.STRING },
              replacement: { type: Type.STRING },
              explanation_zh: { type: Type.STRING }
            },
            required: ["range", "type", "original", "replacement", "explanation_zh"]
          }
        }
      }
    });

    if (!response.text) throw new Error("Failed to generate diagnostics.");
    return JSON.parse(response.text) as DiagnosticAnnotation[];
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error(JSON.stringify({ type: 'RATE_LIMIT', retryDelay: 15 }));
    }
    throw error;
  }
};

export const generateOfficialScore = async (text: string, taskType: 'task1' | 'task2'): Promise<ScoringResult> => {
  const taskName = taskType === 'task1' ? 'Task 1' : 'Task 2';
  const taTrName = taskType === 'task1' ? 'TA' : 'TR';
  
  const prompt = `
Evaluate this IELTS Academic ${taskName} essay.

BAND KEYWORDS (1-9):
9: Flawless, precise, natural, fully developed.
8: Very clear, skillful, occasional minor errors.
7: Clear, logical, good vocabulary/grammar, some errors.
6: Adequate, some irrelevance, mechanical cohesion, noticeable errors.
5: Partial, repetitive, limited vocabulary, frequent errors.
4: Tangential, poor cohesion, basic vocabulary, severe errors.
1-3: Extremely limited, incomprehensible, memorized.

INSTRUCTIONS:
- Score 1.0-9.0 (0.5 increments) for: ${taTrName}, CC, LR, GRA.
- Penalty: Task 1 <150 words or Task 2 <250 words MUST reduce ${taTrName} score.
- Provide concise feedback quoting descriptors.

OUTPUT FORMAT (JSON):
{
  "ta_tr_score": number, "cc_score": number, "lr_score": number, "gra_score": number,
  "ta_tr_feedback": string, "cc_feedback": string, "lr_feedback": string, "gra_feedback": string
}

Essay:
"""
${text}
"""
`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ta_tr_score: { type: Type.NUMBER },
            cc_score: { type: Type.NUMBER },
            lr_score: { type: Type.NUMBER },
            gra_score: { type: Type.NUMBER },
            ta_tr_feedback: { type: Type.STRING },
            cc_feedback: { type: Type.STRING },
            lr_feedback: { type: Type.STRING },
            gra_feedback: { type: Type.STRING },
          },
          required: ["ta_tr_score", "cc_score", "lr_score", "gra_score", "ta_tr_feedback", "cc_feedback", "lr_feedback", "gra_feedback"]
        }
      }
    });

    if (!response.text) throw new Error("Failed to generate scoring report.");
    const result = JSON.parse(response.text);
    const overall_score = calculateOverallBand(result.ta_tr_score, result.cc_score, result.lr_score, result.gra_score);
    return { ...result, overall_score };
  } catch (error: any) {
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error(JSON.stringify({ type: 'RATE_LIMIT', retryDelay: 15 }));
    }
    throw error;
  }
};
