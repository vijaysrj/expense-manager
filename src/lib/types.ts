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

export type AverageUnit = "day" | "week" | "month" | "year";

export interface ReportSpec {
  title: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  averageUnit: AverageUnit;
  excludeCategories: Category[];
  excludeTerms: string[]; // case-insensitive matches against the description
}

export interface CategoryTotal {
  category: Category;
  total: number;
  typicalTotal: number; // without one-offs
  count: number;
  share: number; // 0..1 of the overall total
}

export interface TrendBucket {
  label: string;
  start: string;
  total: number;
  typicalTotal: number;
}

export interface Report {
  spec: ReportSpec;
  currency: string;
  /** Period actually used for averages (clipped to today and to the first tracked expense). */
  effectiveStart: string;
  effectiveEnd: string;
  days: number;
  count: number;
  total: number;
  typicalTotal: number; // without one-offs
  oneOffTotal: number;
  excludedTotal: number; // left out by excludeCategories / excludeTerms
  excludedCount: number;
  average: number; // per averageUnit, with one-offs
  typicalAverage: number; // per averageUnit, without one-offs
  categories: CategoryTotal[];
  trend: TrendBucket[];
  trendUnit: "day" | "week" | "month";
  biggest: Expense[];
  oneOffs: Expense[];
}

export interface AdviceTip {
  title: string;
  detail: string;
  estimatedMonthlySaving: number | null;
}

export interface Advice {
  headline: string;
  tips: AdviceTip[];
  start: string;
  end: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  expenses: Expense[];
  report: Report | null;
  advice: Advice | null;
  createdAt: string;
}
