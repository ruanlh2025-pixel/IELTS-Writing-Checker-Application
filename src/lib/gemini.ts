import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface ScoreResult {
  ta_tr: number;
  cc: number;
  lr: number;
  gra: number;
  ta_tr_comment: string;
  cc_comment: string;
  lr_comment: string;
  gra_comment: string;
}

export async function scoreEssay(text: string, taskType: 'task1' | 'task2'): Promise<ScoreResult> {
  const prompt = `
你是一个专业的雅思前考官。请根据以下官方 Band Descriptors 严格对用户的雅思 \${taskType === 'task1' ? 'A类小作文 (Task 1)' : 'A类大作文 (Task 2)'} 进行评分。

【评分标准】
1. Task 1 (Academic) 判定细节 (1-9 分)：
Task Achievement (TA):
9分： 完全满足要求；极好地总结特征；数据极其精准。
8分： 涵盖所有要求；关键特征展现非常清晰、客观。
7分： 有清晰概述；能对重要特征进行对比；细节充足。
6分： 有概述；选出了主要特征但细节描述可能不充分或不准确。
5分： 机械描述数据；无清晰概述；遗漏关键趋势或极值。
4分： 格式错误；基本不提关键特征；字数严重不足。
1-3分： 几乎不回应题目；全是乱码、抄袭或仅有极个别孤立词汇。
Coherence & Cohesion (CC):
8-9分： 逻辑衔接极其自然（Effortless）；段落划分极其精妙。
7分： 逻辑推进自然；衔接词使用多样但可能有极个别不当。
6分： 整体连贯；但衔接词可能使用机械（Mechanical）或过度重复。
5分： 缺乏整体进步感；衔接词不当或不足；段落划分不合理。
4分： 衔接词极少且错误频繁；内容不连贯。
LR & GRA (词汇与语法):
8-9分： 极其丰富的词汇量；句式变换极其灵活；全篇几乎无错（Rare slips only）。
7分： 使用了少见的词汇（Less common items）；大部分句子无错（Error-free sentences）。
5-6分： 词汇仅够基本表达；语法错误频繁出现，虽然不影响理解。
1-4分： 只有背诵的固定模版；错误密度大到严重阻碍沟通。

2. Task 2 (Essay) 判定细节 (1-9 分)：
Task Response (TR):
9分： 完美回应题目所有部分；论点极其充分且立场贯穿始终。
8分： 充分回应题目；论点有非常清晰的支持和扩展。
7分： 立场明确；论点扩展充分但可能有过度概括（Over-generalise）倾向。
6分： 回应了所有部分；有立场但论点展开不足，或结论不够清晰。
5分： 仅回应了部分要求；立场动摇或不明确；论点缺乏逻辑支持。
4分： 严重跑题；立场极度模糊。
1-3分： 与题目无关；内容完全无法理解。
CC, LR, GRA (高低分分水岭):
8-9分判定点： 考察衔接词的“隐形化”（Invisibly coherent）；考察词汇的“母语化”地道搭配（Collocation）；语法必须包含大量复杂的从句结构。
7分判定点： 关键词——“准确”。大部分复杂句必须写对。
5分判定点： 关键词——“尝试”。尝试写复杂句但失败，尝试用高级词但用错。
1-4分判定点： 关键词——“破碎”。句子结构破碎，词汇极其匮乏且重复严重。

【用户作文】
\${text}

请返回 JSON 格式的评分结果，包含 TA (或 TR), CC, LR, GRA 四个维度的整数分数（1-9），以及每个维度的简短中文点评（50字以内）。
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          ta_tr: { type: Type.INTEGER, description: "TA (Task 1) or TR (Task 2) score, 1-9" },
          cc: { type: Type.INTEGER, description: "CC score, 1-9" },
          lr: { type: Type.INTEGER, description: "LR score, 1-9" },
          gra: { type: Type.INTEGER, description: "GRA score, 1-9" },
          ta_tr_comment: { type: Type.STRING },
          cc_comment: { type: Type.STRING },
          lr_comment: { type: Type.STRING },
          gra_comment: { type: Type.STRING },
        },
        required: ["ta_tr", "cc", "lr", "gra", "ta_tr_comment", "cc_comment", "lr_comment", "gra_comment"]
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to generate score");
  }

  return JSON.parse(response.text) as ScoreResult;
}
