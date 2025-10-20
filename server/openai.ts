import OpenAI from "openai";
import type { ExtractedData } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractContractData(text: string): Promise<ExtractedData> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing construction contracts. Extract key information and provide confidence scores (0-100) for each extraction. Respond with JSON in this exact format:
{
  "keyDates": [
    {"label": "Contract Start Date", "value": "date or null", "confidence": 0-100},
    {"label": "Completion Date", "value": "date or null", "confidence": 0-100},
    {"label": "Payment Due Date", "value": "date or null", "confidence": 0-100},
    {"label": "Milestone Review", "value": "date or null", "confidence": 0-100}
  ],
  "accessDetails": [
    {"label": "Site Access Hours", "value": "hours or null", "confidence": 0-100},
    {"label": "Access Restrictions", "value": "restrictions or null", "confidence": 0-100},
    {"label": "Key Holder", "value": "name or null", "confidence": 0-100},
    {"label": "Emergency Contact", "value": "contact or null", "confidence": 0-100}
  ],
  "damages": [
    {"label": "Liquidated Damages", "value": "amount or null", "confidence": 0-100},
    {"label": "Late Payment Fee", "value": "fee or null", "confidence": 0-100},
    {"label": "Performance Bond", "value": "amount or null", "confidence": 0-100},
    {"label": "Warranty Period", "value": "period or null", "confidence": 0-100}
  ]
}

If a field cannot be found, set value to null and confidence to 0.`,
        },
        {
          role: "user",
          content: `Extract the following information from this construction contract:\n\n${text.substring(0, 12000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result as ExtractedData;
  } catch (error) {
    console.error("Failed to extract contract data:", error);
    throw new Error("Failed to extract contract data");
  }
}

export async function answerContractQuery(
  contractText: string,
  question: string
): Promise<{ answer: string; source: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing construction contracts. Answer questions based on the provided contract text. Respond with JSON in this format:
{
  "answer": "your answer here",
  "source": "Section X, Page Y or relevant location"
}

If the answer cannot be found in the contract, say so clearly and set source to "Not found in contract".`,
        },
        {
          role: "user",
          content: `Contract text:\n\n${contractText.substring(0, 12000)}\n\nQuestion: ${question}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      answer: result.answer || "Unable to answer the question.",
      source: result.source || "Unknown",
    };
  } catch (error) {
    console.error("Failed to answer contract query:", error);
    throw new Error("Failed to answer query");
  }
}
