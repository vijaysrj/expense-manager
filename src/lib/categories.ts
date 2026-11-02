export const CATEGORIES = [
  "Food & Drinks",
  "Groceries",
  "Transport",
  "Fuel",
  "Shopping",
  "Bills & Utilities",
  "Rent & Housing",
  "Education",
  "Health",
  "Entertainment",
  "Travel",
  "Personal Care",
  "Gifts & Donations",
  "Family",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_EMOJI: Record<Category, string> = {
  "Food & Drinks": "🍽️",
  Groceries: "🛒",
  Transport: "🚕",
  Fuel: "⛽",
  Shopping: "🛍️",
  "Bills & Utilities": "💡",
  "Rent & Housing": "🏠",
  Education: "🎓",
  Health: "💊",
  Entertainment: "🎬",
  Travel: "✈️",
  "Personal Care": "💇",
  "Gifts & Donations": "🎁",
  Family: "👨‍👩‍👧",
  Other: "🧾",
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
