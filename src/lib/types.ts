import type { Category } from "./categories";

export interface Expense {
  id: number;
  amount: number;
  currency: string;
  category: Category;
  description: string;
  spentOn: string; // YYYY-MM-DD
  isOneOff: boolean;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  expenses: Expense[];
  createdAt: string;
}
