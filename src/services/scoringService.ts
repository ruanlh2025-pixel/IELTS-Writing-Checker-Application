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
    focus = "Focus on correcting basic grammar errors, ensuring clear sentence structures, and meeting the minimum word count.";
  } else if (currentScore < 7.5) {
    targetScoreStr = (currentScore + 1.0).toFixed(1);
    focus = "Focus on upgrading academic vocabulary (Lexical Resource) and improving the use of cohesive devices (Coherence and Cohesion).";
  } else {
    targetScoreStr = "8.5-9.0";
    focus = "Focus on absolute precision of expression, native-like collocations, and deep logical coherence.";
  }

  const taskName = taskType === 'task1' ? 'Task 1 (Academic Graph/Chart Description)' : 'Task 2 (Academic Essay)';
  const minWords = taskType === 'task1' ? 150 : 250;

  const prompt = `
You are an expert IELTS examiner and tutor. The student has written an IELTS ${taskName} essay that currently scores a Band ${currentScore.toFixed(1)}.
Your task is to rewrite the essay to achieve a Band ${targetScoreStr}.

CRITICAL CONSTRAINTS:
1. DO NOT change the student's original position, core arguments, or main ideas. You MUST improve the essay within the student's existing argumentative framework. Do not write a completely new essay with different ideas.
2. The rewritten essay MUST be at least ${minWords} words long.
3. ${focus}
4. In the rewritten essay, highlight the specific words or phrases that you upgraded or improved by wrapping them in double asterisks (e.g., **acquire** instead of get).

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "essay": "The full rewritten essay text, with **upgraded parts** highlighted in bold.",
  "targetScore": "${targetScoreStr}",
  "improvements": [
    "Action 1: Detailed Chinese explanation of a key improvement made (e.g., '动作 1：将开头段改写为主动 + 被动混合句，提升了 GRA 维度。')",
    "Action 2: Detailed Chinese explanation of another key improvement.",
    "Action 3: Detailed Chinese explanation of a third key improvement."
  ]
}
Provide 3 to 5 improvements.

Student's Original Essay:
"""
${text}
"""
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          essay: { type: Type.STRING, description: "The rewritten essay with **markdown bold** for highlights." },
          targetScore: { type: Type.STRING },
          improvements: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "3-5 key improvement actions in Chinese."
          }
        },
        required: ["essay", "targetScore", "improvements"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate model essay.");
  }

  return JSON.parse(response.text) as ModelEssayResult;
};

export const generateDiagnostics = async (text: string): Promise<DiagnosticAnnotation[]> => {
  const prompt = `
You are an expert IELTS examiner and tutor. Perform a sentence-by-sentence diagnostic of the following IELTS writing submission.
Identify errors, areas for improvement, and excellent usages.

Categorize your annotations into the following types:
- "Red": Critical Errors (Grammar, Subject-Verb agreement, Tense, Part of speech, Spelling). Corresponds to GRA.
- "Blue": Lexical Upgrades (Replacing simple words with Academic Words, fixing Collocation). Corresponds to LR.
- "Yellow": Logic & Coherence (Unclear referencing, wrong connectors, missing topic sentences). Corresponds to CC/TR.
- "Green": Positive Feedback (Praise for excellent use of complex sentences, great vocabulary, etc.).

Requirements for the output:
1. Return a JSON array of annotation objects.
2. Each object MUST have:
   - "range": [start_index, end_index] (The exact character indices in the text where the original string is located. 0-indexed.)
   - "type": "Red" | "Blue" | "Yellow" | "Green"
   - "original": The exact substring from the text that needs changing (or is being praised).
   - "replacement": The suggested correction or upgrade. (For "Green", this can be empty or the same as original).
   - "explanation_zh": Detailed Chinese explanation. MUST include: 1. The reason for the change/praise. 2. A "阶梯式解释" (Tiered explanation) linking to the band score, e.g., "此修改能帮你从 GRA 5 分跨越到 6 分" or "完全符合 GRA 7 分的标准，请保持！".
3. If the essay is perfect, you MUST provide at least 3 "可以做得更好" (could be better) points as Blue or Yellow annotations to push for a higher score (e.g., 8.0 or 9.0).

Essay to evaluate:
"""
${text}
"""
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            range: {
              type: Type.ARRAY,
              items: { type: Type.INTEGER },
              description: "Start and end character indices of the original text."
            },
            type: { type: Type.STRING, description: "Red, Blue, Yellow, or Green" },
            original: { type: Type.STRING },
            replacement: { type: Type.STRING },
            explanation_zh: { type: Type.STRING }
          },
          required: ["range", "type", "original", "replacement", "explanation_zh"]
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate diagnostics.");
  }

  return JSON.parse(response.text) as DiagnosticAnnotation[];
};

export const generateOfficialScore = async (text: string, taskType: 'task1' | 'task2'): Promise<ScoringResult> => {
  const taskName = taskType === 'task1' ? 'Task 1 (Academic Graph/Chart Description)' : 'Task 2 (Academic Essay)';
  const taTrName = taskType === 'task1' ? 'Task Achievement (TA)' : 'Task Response (TR)';
  
  const prompt = `
You are an expert IELTS examiner. Evaluate the following IELTS Academic ${taskName} writing submission.
Strictly adhere to the official IELTS Band Descriptors (1-9) for:
1. ${taTrName}
2. Coherence and Cohesion (CC)
3. Lexical Resource (LR)
4. Grammatical Range and Accuracy (GRA)

CRITICAL INSTRUCTIONS:
- Provide a score (1.0 to 9.0, strictly in 0.5 increments) for each of the 4 criteria.
- Word Count Penalty: For Task 1, the minimum is 150 words. For Task 2, the minimum is 250 words. If the essay is significantly under the word count, you MUST penalize the ${taTrName} score accordingly (e.g., a severely short essay should receive a 4.0 or lower in ${taTrName}).
- Also provide detailed feedback for each criterion. The feedback MUST quote directly from the official IELTS Band Descriptors to justify the score.

Essay to evaluate:
"""
${text}
"""
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ta_tr_score: { type: Type.NUMBER, description: `Score for ${taTrName} (1.0 - 9.0)` },
          cc_score: { type: Type.NUMBER, description: "Score for Coherence and Cohesion (1.0 - 9.0)" },
          lr_score: { type: Type.NUMBER, description: "Score for Lexical Resource (1.0 - 9.0)" },
          gra_score: { type: Type.NUMBER, description: "Score for Grammatical Range and Accuracy (1.0 - 9.0)" },
          ta_tr_feedback: { type: Type.STRING, description: `Feedback for ${taTrName}, quoting official descriptors.` },
          cc_feedback: { type: Type.STRING, description: "Feedback for CC, quoting official descriptors." },
          lr_feedback: { type: Type.STRING, description: "Feedback for LR, quoting official descriptors." },
          gra_feedback: { type: Type.STRING, description: "Feedback for GRA, quoting official descriptors." },
        },
        required: ["ta_tr_score", "cc_score", "lr_score", "gra_score", "ta_tr_feedback", "cc_feedback", "lr_feedback", "gra_feedback"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate scoring report.");
  }

  const result = JSON.parse(response.text);
  const overall_score = calculateOverallBand(
    result.ta_tr_score,
    result.cc_score,
    result.lr_score,
    result.gra_score
  );

  return {
    ...result,
    overall_score
  };
};
