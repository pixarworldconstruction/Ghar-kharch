export type PaymentMode = 'Cash' | 'Credit Card' | 'UPI' | 'Bank';

export interface Expense {
  id?: string;
  item: string;
  category: string;
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  date: string;
  paymentMode?: PaymentMode;
  cardId?: string; // ID of the credit card used
  bankId?: string; // ID of the bank used for Bank/UPI payments
  created_at?: string;
  updated_at?: string;
  added_by?: string; // UID of the user who added it
}

export interface CreditCard {
  id?: string;
  name: string;
  limit: number;
  billDate: string; // Day of month (1-31)
  dueDate: string; // Day of month (1-31)
  dueAmount?: number;
  lastUpdated?: string;
}

export interface Bank {
  id?: string;
  name: string;
  initialBalance: number;
  lastUpdated?: string;
}

export interface BankTransaction {
  id?: string;
  bankId: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  date: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  familyId: string | null;
  role: 'admin' | 'member';
  displayName?: string;
  photoURL?: string;
}

export interface Family {
  id: string;
  name: string;
  adminUid: string;
  inviteCode: string;
  members: Record<string, boolean>; // uid -> true
}

export type Category = string;

export const CATEGORIES: string[] = [
  'Groceries',
  'Vegetables',
  'Snacks',
  'Utilities',
  'Dining',
  'Dairy',
  'Other',
  'Custom...'
];

export const UNITS = ['g', 'kg', 'L', 'ml', 'pcs', 'unit'];

export const PAYMENT_MODES: PaymentMode[] = ['Cash', 'Credit Card', 'UPI', 'Bank'];
