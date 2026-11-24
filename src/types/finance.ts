export type AccountId = 'suami' | 'istri' | 'keluarga';

export interface Account {
  id: AccountId;
  defaultName: string;
  displayName: string;
  description: string;
  editableName: boolean;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

export type CategoryScope = 'pribadi' | 'keluarga' | 'semua';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  scope: CategoryScope;
  isDefault: boolean;
  isSystemSavings?: boolean;
}

export interface Transaction {
  id: string;
  /** ISO date format: YYYY-MM-DD */
  date: string;
  type: TransactionType;
  /** Used when type is 'income' or 'expense' */
  accountId?: AccountId;
  /** Used when type is 'transfer' */
  fromAccountId?: AccountId;
  /** Used when type is 'transfer' */
  toAccountId?: AccountId;
  /** Category ID (optional for transfer) */
  categoryId?: string;
  /** Strictly positive integer Rupiah */
  amount: number;
  description: string;
  notes?: string;
  /** Links an expense transaction atomically to a savings deposit entry */
  linkedSavingEntryId?: string;
  linkedSavingGoalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  year: number;
  /** 1-12 */
  month: number;
  /** Strictly positive integer Rupiah */
  limitAmount: number;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  /** Strictly positive integer Rupiah */
  targetAmount: number;
  storageAccountId: AccountId;
  /** Optional ISO date YYYY-MM-DD */
  targetDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsEntry {
  id: string;
  goalId: string;
  sourceAccountId: AccountId;
  /** Atomic linked expense transaction ID on sourceAccountId */
  transactionId: string;
  /** ISO date format: YYYY-MM-DD */
  date: string;
  /** Strictly positive integer Rupiah */
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface AppSettings {
  id: 'main';
  lastBackupAt: string | null;
  backupReminderDays: number;
  currency: 'IDR';
}

export interface FinanceState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  savingsEntries: SavingsEntry[];
  settings: AppSettings;
}

export interface BackupPayload {
  schemaVersion: 1;
  appName: 'Kas Rumah';
  exportedAt: string;
  data: FinanceState;
}

export type NavSection =
  | 'dashboard'
  | 'transaksi'
  | 'akun'
  | 'kontribusi'
  | 'anggaran'
  | 'tabungan'
  | 'laporan'
  | 'pengaturan';

export type ReportPeriodMode = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
