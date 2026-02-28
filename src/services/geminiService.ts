import { GoogleGenAI } from "@google/genai";
import { Expense } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getSavingsSuggestions(expenses: Expense[]) {
  if (expenses.length === 0) {
    return "Add some expenses to get personalized savings suggestions!";
  }

  const model = "gemini-3-flash-preview";
  const expenseSummary = expenses
    .map(e => `${e.date}: ${e.item} (${e.category}) - ₹${e.amount}${e.quantity ? ` [${e.quantity}${e.unit}]` : ''}`)
    .join('\n');

  const prompt = `
    As a personal finance expert, analyze the following household expenses and provide 3-4 concise, actionable tips to save money.
    Focus on patterns, high-cost categories, and common household savings (like electricity, bulk buying, etc.).
    Keep the tone encouraging and professional.
    
    Expenses:
    ${expenseSummary}
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error getting suggestions:", error);
    return "I'm having trouble analyzing your expenses right now. Try again later!";
  }
}
