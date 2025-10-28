import OpenAI from "openai";
import type { ExtractedData } from "@shared/schema";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function extractContractData(text: string): Promise<ExtractedData> {
  try {
    console.log(`Sending ${text.length} characters to OpenAI for extraction...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert at analyzing construction contracts including NEC, JCT, and FIDIC contracts. 

Extract key information from the contract and provide confidence scores (0-100) for each extraction based on how clearly the information is stated in the contract.

Respond with JSON in this exact format:
{
  "keyDates": [
    {"label": "Contract Start Date", "value": "date or description", "confidence": 0-100},
    {"label": "Completion Date", "value": "date or description", "confidence": 0-100},
    {"label": "Key Milestone", "value": "date or description", "confidence": 0-100},
    {"label": "Notice Period", "value": "period or description", "confidence": 0-100}
  ],
  "accessDetails": [
    {"label": "Site Location", "value": "location details", "confidence": 0-100},
    {"label": "Working Hours", "value": "hours or restrictions", "confidence": 0-100},
    {"label": "Access Requirements", "value": "requirements or restrictions", "confidence": 0-100},
    {"label": "Site Contact", "value": "name or role", "confidence": 0-100}
  ],
  "damages": [
    {"label": "Liquidated Damages", "value": "amount per day/week or description", "confidence": 0-100},
    {"label": "Delay Damages", "value": "amount or description", "confidence": 0-100},
    {"label": "Performance Bond", "value": "amount or percentage", "confidence": 0-100},
    {"label": "Retention Amount", "value": "amount or percentage", "confidence": 0-100}
  ]
}

IMPORTANT: 
- Extract actual information from the contract text
- If you find relevant information, include it even if the label doesn't match exactly
- Set confidence based on clarity: 90-100 for explicit dates/amounts, 70-89 for clear descriptions, 50-69 for implied information, below 50 for uncertain
- Only set value to null and confidence to 0 if the information truly cannot be found`,
        },
        {
          role: "user",
          content: `Analyze this construction contract and extract the key dates, access details, and damages information:\n\n${text.substring(0, 30000)}`,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0].message.content || "{}";
    console.log("OpenAI raw response:", content.substring(0, 500));
    const result = JSON.parse(content);
    console.log("✓ OpenAI extracted data:", JSON.stringify(result, null, 2));
    
    // Validate and ensure proper structure
    const extractedData: ExtractedData = {
      keyDates: Array.isArray(result.keyDates) ? result.keyDates : [],
      accessDetails: Array.isArray(result.accessDetails) ? result.accessDetails : [],
      damages: Array.isArray(result.damages) ? result.damages : [],
    };
    
    return extractedData;
  } catch (error) {
    console.error("Failed to extract contract data:", error);
    
    // Check for OpenAI-specific errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; code?: string; message?: string };
      if (apiError.status === 429 || apiError.code === 'insufficient_quota') {
        throw new Error("OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits.");
      }
      if (apiError.status === 401) {
        throw new Error("OpenAI API authentication failed. Please check your API key.");
      }
    }
    
    throw new Error("Failed to extract contract data");
  }
}

export async function answerContractQuery(
  contractText: string,
  question: string
): Promise<{ answer: string; source: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
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
    
    // Check for OpenAI-specific errors
    if (error && typeof error === 'object' && 'status' in error) {
      const apiError = error as { status: number; code?: string; message?: string };
      if (apiError.status === 429 || apiError.code === 'insufficient_quota') {
        throw new Error("OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits.");
      }
      if (apiError.status === 401) {
        throw new Error("OpenAI API authentication failed. Please check your API key.");
      }
    }
    
    throw new Error("Failed to answer query");
  }
}
