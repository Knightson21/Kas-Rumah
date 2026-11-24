import { DEFAULT_ACCOUNTS, DEFAULT_SETTINGS } from '../data/defaults';
import type {
  AccountId,
  AppSettings,
  BackupPayload,
  Budget,
  Category,
  FinanceState,
  SavingsEntry,
  SavingsGoal,
  Transaction,
} from '../types/finance';
import { getTodayISO, toSafeRupiah } from './format';

const VALID_ACCOUNT_IDS = new Set<AccountId>(['suami', 'istri', 'keluarga']);
const VALID_TX_TYPES = new Set(['income', 'expense', 'transfer']);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface BackupValidationSuccess {
  valid: true;
  payload: BackupPayload;
  summary: {
    exportedAt: string;
    transactionsCount: number;
    categoriesCount: number;
    budgetsCount: number;
    savingsGoalsCount: number;
    savingsEntriesCount: number;
  };
}

export interface BackupValidationFailure {
  valid: false;
  error: string;
}

export type BackupValidationResult = BackupValidationSuccess | BackupValidationFailure;

export function buildBackupPayload(state: FinanceState): BackupPayload {
  return {
    schemaVersion: 1,
    appName: 'Kas Rumah',
    exportedAt: new Date().toISOString(),
    data: {
      accounts: state.accounts,
      categories: state.categories,
      transactions: state.transactions,
      budgets: state.budgets,
      savingsGoals: state.savingsGoals,
      savingsEntries: state.savingsEntries,
      settings: state.settings,
    },
  };
}

/**
 * Strictly validates an untrusted JSON object before allowing restore into IndexedDB.
 */
export function validateBackupPayload(raw: unknown): BackupValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'File JSON tidak valid atau kosong.' };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1 || obj.appName !== 'Kas Rumah') {
    return {
      valid: false,
      error: 'Format file bukan backup resmi aplikasi Kas Rumah (versi skema tidak sesuai).',
    };
  }

  const data = obj.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Struktur data di dalam file backup tidak ditemukan.' };
  }

  if (
    !Array.isArray(data.accounts) ||
    !Array.isArray(data.categories) ||
    !Array.isArray(data.transactions) ||
    !Array.isArray(data.budgets) ||
    !Array.isArray(data.savingsGoals) ||
    !Array.isArray(data.savingsEntries)
  ) {
    return {
      valid: false,
      error: 'Salah satu tabel data (akun, kategori, transaksi, anggaran, atau tabungan) hilang atau rusak.',
    };
  }

  // Validate accounts & guarantee all 3 core accounts exist
  const accountMap = new Map(DEFAULT_ACCOUNTS.map((a) => [a.id, { ...a }]));
  for (const item of data.accounts) {
    if (!item || typeof item !== 'object') continue;
    const acc = item as Record<string, unknown>;
    if (typeof acc.id === 'string' && VALID_ACCOUNT_IDS.has(acc.id as AccountId)) {
      const base = accountMap.get(acc.id as AccountId)!;
      const customName =
        typeof acc.displayName === 'string' && acc.displayName.trim()
          ? acc.displayName.trim()
          : base.defaultName;
      accountMap.set(base.id, {
        ...base,
        displayName: base.editableName ? customName : base.defaultName,
      });
    }
  }
  const validatedAccounts = Array.from(accountMap.values());

  // Validate categories
  const validatedCategories: Category[] = [];
  for (const item of data.categories) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Data kategori di file backup tidak valid.' };
    }
    const c = item as Record<string, unknown>;
    if (
      typeof c.id !== 'string' ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      (c.type !== 'income' && c.type !== 'expense')
    ) {
      return { valid: false, error: 'Terdapat kategori dengan format nama atau jenis yang tidak valid.' };
    }
    validatedCategories.push({
      id: c.id,
      name: c.name.trim(),
      type: c.type,
      scope: c.scope === 'pribadi' || c.scope === 'keluarga' ? c.scope : 'semua',
      isDefault: Boolean(c.isDefault),
      isSystemSavings: Boolean(c.isSystemSavings),
    });
  }

  if (validatedCategories.length === 0) {
    return { valid: false, error: 'Daftar kategori tidak boleh kosong.' };
  }

  // Validate transactions
  const validatedTransactions: Transaction[] = [];
  for (let i = 0; i < data.transactions.length; i++) {
    const item = data.transactions[i];
    if (!item || typeof item !== 'object') {
      return { valid: false, error: `Transaksi urutan #${i + 1} rusak.` };
    }
    const t = item as Record<string, unknown>;
    const amount = typeof t.amount === 'number' ? toSafeRupiah(t.amount) : 0;
    if (
      typeof t.id !== 'string' ||
      typeof t.date !== 'string' ||
      !ISO_DATE_RE.test(t.date) ||
      typeof t.type !== 'string' ||
      !VALID_TX_TYPES.has(t.type) ||
      amount <= 0
    ) {
      return {
        valid: false,
        error: `Transaksi urutan #${i + 1} memiliki tanggal, jenis, atau nominal tidak valid (nominal harus positif).`,
      };
    }

    if (t.type === 'transfer') {
      if (
        !VALID_ACCOUNT_IDS.has(t.fromAccountId as AccountId) ||
        !VALID_ACCOUNT_IDS.has(t.toAccountId as AccountId) ||
        t.fromAccountId === t.toAccountId
      ) {
        return {
          valid: false,
          error: `Transaksi transfer urutan #${i + 1} memiliki akun sumber/tujuan yang tidak valid.`,
        };
      }
    } else if (!VALID_ACCOUNT_IDS.has(t.accountId as AccountId)) {
      return {
        valid: false,
        error: `Transaksi urutan #${i + 1} memiliki akun terkait yang tidak valid.`,
      };
    }

    validatedTransactions.push({
      id: t.id,
      date: t.date,
      type: t.type as Transaction['type'],
      accountId: t.type === 'transfer' ? undefined : (t.accountId as AccountId),
      fromAccountId: t.type === 'transfer' ? (t.fromAccountId as AccountId) : undefined,
      toAccountId: t.type === 'transfer' ? (t.toAccountId as AccountId) : undefined,
      categoryId: typeof t.categoryId === 'string' ? t.categoryId : undefined,
      amount,
      description: typeof t.description === 'string' ? t.description : '',
      notes: typeof t.notes === 'string' ? t.notes : undefined,
      linkedSavingEntryId:
        typeof t.linkedSavingEntryId === 'string' ? t.linkedSavingEntryId : undefined,
      linkedSavingGoalId:
        typeof t.linkedSavingGoalId === 'string' ? t.linkedSavingGoalId : undefined,
      createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString(),
      updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : new Date().toISOString(),
    });
  }

  // Validate budgets
  const validatedBudgets: Budget[] = [];
  for (const item of data.budgets) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Data anggaran tidak valid.' };
    }
    const b = item as Record<string, unknown>;
    const limitAmount = typeof b.limitAmount === 'number' ? toSafeRupiah(b.limitAmount) : 0;
    if (
      typeof b.id !== 'string' ||
      typeof b.categoryId !== 'string' ||
      typeof b.year !== 'number' ||
      typeof b.month !== 'number' ||
      b.month < 1 ||
      b.month > 12 ||
      limitAmount <= 0
    ) {
      return { valid: false, error: 'Terdapat data anggaran dengan periode atau nominal tidak valid.' };
    }
    validatedBudgets.push({
      id: b.id,
      categoryId: b.categoryId,
      year: Math.round(b.year),
      month: Math.round(b.month),
      limitAmount,
      updatedAt: typeof b.updatedAt === 'string' ? b.updatedAt : new Date().toISOString(),
    });
  }

  // Validate savings goals
  const validatedGoals: SavingsGoal[] = [];
  for (const item of data.savingsGoals) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Data target tabungan tidak valid.' };
    }
    const g = item as Record<string, unknown>;
    const targetAmount = typeof g.targetAmount === 'number' ? toSafeRupiah(g.targetAmount) : 0;
    if (
      typeof g.id !== 'string' ||
      typeof g.name !== 'string' ||
      !g.name.trim() ||
      targetAmount <= 0 ||
      !VALID_ACCOUNT_IDS.has(g.storageAccountId as AccountId)
    ) {
      return { valid: false, error: 'Terdapat target tabungan dengan format tidak valid.' };
    }
    validatedGoals.push({
      id: g.id,
      name: g.name.trim(),
      targetAmount,
      storageAccountId: g.storageAccountId as AccountId,
      targetDate:
        typeof g.targetDate === 'string' && ISO_DATE_RE.test(g.targetDate)
          ? g.targetDate
          : undefined,
      notes: typeof g.notes === 'string' ? g.notes : undefined,
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date().toISOString(),
      updatedAt: typeof g.updatedAt === 'string' ? g.updatedAt : new Date().toISOString(),
    });
  }

  // Validate savings entries
  const validatedEntries: SavingsEntry[] = [];
  for (const item of data.savingsEntries) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Data riwayat setoran tabungan tidak valid.' };
    }
    const e = item as Record<string, unknown>;
    const amount = typeof e.amount === 'number' ? toSafeRupiah(e.amount) : 0;
    if (
      typeof e.id !== 'string' ||
      typeof e.goalId !== 'string' ||
      typeof e.transactionId !== 'string' ||
      typeof e.date !== 'string' ||
      !ISO_DATE_RE.test(e.date) ||
      !VALID_ACCOUNT_IDS.has(e.sourceAccountId as AccountId) ||
      amount <= 0
    ) {
      return { valid: false, error: 'Terdapat riwayat setoran tabungan yang tidak valid.' };
    }
    validatedEntries.push({
      id: e.id,
      goalId: e.goalId,
      sourceAccountId: e.sourceAccountId as AccountId,
      transactionId: e.transactionId,
      date: e.date,
      amount,
      notes: typeof e.notes === 'string' ? e.notes : undefined,
      createdAt: typeof e.createdAt === 'string' ? e.createdAt : new Date().toISOString(),
    });
  }

  const rawSettings = (data.settings ?? {}) as Record<string, unknown>;
  const validatedSettings: AppSettings = {
    id: 'main',
    lastBackupAt: typeof rawSettings.lastBackupAt === 'string' ? rawSettings.lastBackupAt : null,
    backupReminderDays:
      typeof rawSettings.backupReminderDays === 'number' && rawSettings.backupReminderDays >= 1
        ? Math.round(rawSettings.backupReminderDays)
        : DEFAULT_SETTINGS.backupReminderDays,
    currency: 'IDR',
  };

  const payload: BackupPayload = {
    schemaVersion: 1,
    appName: 'Kas Rumah',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    data: {
      accounts: validatedAccounts,
      categories: validatedCategories,
      transactions: validatedTransactions,
      budgets: validatedBudgets,
      savingsGoals: validatedGoals,
      savingsEntries: validatedEntries,
      settings: validatedSettings,
    },
  };

  return {
    valid: true,
    payload,
    summary: {
      exportedAt: payload.exportedAt,
      transactionsCount: validatedTransactions.length,
      categoriesCount: validatedCategories.length,
      budgetsCount: validatedBudgets.length,
      savingsGoalsCount: validatedGoals.length,
      savingsEntriesCount: validatedEntries.length,
    },
  };
}

export function downloadBackupJson(state: FinanceState): string {
  const payload = buildBackupPayload(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const filename = `backup-kas-rumah-${getTodayISO()}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return payload.exportedAt;
}

export function isBackupReminderDue(settings: AppSettings, transactionCount: number): boolean {
  if (transactionCount === 0) return false;
  if (!settings.lastBackupAt) return true;
  const last = new Date(settings.lastBackupAt).getTime();
  if (Number.isNaN(last)) return true;
  const daysElapsed = (Date.now() - last) / (1000 * 60 * 60 * 24);
  return daysElapsed >= (settings.backupReminderDays || 14);
}
