import {
  DEFAULT_ACCOUNTS,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  SAVINGS_EXPENSE_CATEGORY_ID,
} from '../data/defaults';
import type {
  Account,
  AccountId,
  AppSettings,
  Budget,
  Category,
  FinanceState,
  SavingsEntry,
  SavingsGoal,
  Transaction,
} from '../types/finance';
import { createId, toSafeRupiah } from '../utils/format';

const DB_NAME = 'KasRumahDB';
const DB_VERSION = 1;

const STORES = {
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  savingsGoals: 'savings_goals',
  savingsEntries: 'savings_entries',
  settings: 'settings',
} as const;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.accounts)) {
        db.createObjectStore(STORES.accounts, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.categories)) {
        const catStore = db.createObjectStore(STORES.categories, { keyPath: 'id' });
        catStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        const txStore = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
        txStore.createIndex('date', 'date', { unique: false });
        txStore.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.budgets)) {
        const budgetStore = db.createObjectStore(STORES.budgets, { keyPath: 'id' });
        budgetStore.createIndex('period', ['year', 'month'], { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.savingsGoals)) {
        db.createObjectStore(STORES.savingsGoals, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.savingsEntries)) {
        const entryStore = db.createObjectStore(STORES.savingsEntries, { keyPath: 'id' });
        entryStore.createIndex('goalId', 'goalId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Gagal membuka IndexedDB.'));
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function runTransaction(
  db: IDBDatabase,
  storeNames: string[],
  mode: IDBTransactionMode,
  executor: (tx: IDBTransaction) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Transaksi penyimpanan gagal.'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaksi penyimpanan dibatalkan.'));
    executor(tx);
  });
}

/**
 * Loads the complete local database state, seeding ONLY default accounts,
 * default categories, and default settings on first launch (zero sample transactions).
 */
export async function loadInitialState(): Promise<FinanceState> {
  const db = await openDatabase();
  try {
    let [accounts, categories, transactions, budgets, savingsGoals, savingsEntries, settingsArr] =
      await Promise.all([
        getAllFromStore<Account>(db, STORES.accounts),
        getAllFromStore<Category>(db, STORES.categories),
        getAllFromStore<Transaction>(db, STORES.transactions),
        getAllFromStore<Budget>(db, STORES.budgets),
        getAllFromStore<SavingsGoal>(db, STORES.savingsGoals),
        getAllFromStore<SavingsEntry>(db, STORES.savingsEntries),
        getAllFromStore<AppSettings>(db, STORES.settings),
      ]);

    const needsSeed =
      accounts.length === 0 || categories.length === 0 || settingsArr.length === 0;

    if (needsSeed) {
      await runTransaction(
        db,
        [STORES.accounts, STORES.categories, STORES.settings],
        'readwrite',
        (tx) => {
          if (accounts.length === 0) {
            const store = tx.objectStore(STORES.accounts);
            for (const acc of DEFAULT_ACCOUNTS) {
              store.put(acc);
            }
          }
          if (categories.length === 0) {
            const store = tx.objectStore(STORES.categories);
            for (const cat of DEFAULT_CATEGORIES) {
              store.put(cat);
            }
          }
          if (settingsArr.length === 0) {
            tx.objectStore(STORES.settings).put(DEFAULT_SETTINGS);
          }
        }
      );

      if (accounts.length === 0) accounts = [...DEFAULT_ACCOUNTS];
      if (categories.length === 0) categories = [...DEFAULT_CATEGORIES];
      if (settingsArr.length === 0) settingsArr = [{ ...DEFAULT_SETTINGS }];
    }

    // Ensure consistent ordering of the three accounts: suami, istri, keluarga
    const order: Record<AccountId, number> = { suami: 0, istri: 1, keluarga: 2 };
    accounts.sort((a, b) => (order[a.id] ?? 9) - (order[b.id] ?? 9));

    return {
      accounts,
      categories,
      transactions,
      budgets,
      savingsGoals,
      savingsEntries,
      settings: settingsArr[0] ?? { ...DEFAULT_SETTINGS },
    };
  } finally {
    db.close();
  }
}

export async function saveTransaction(txData: Transaction): Promise<void> {
  const safeAmount = toSafeRupiah(txData.amount);
  if (safeAmount <= 0) {
    throw new Error('Nominal transaksi harus lebih besar dari Rp0.');
  }
  const cleanTx: Transaction = { ...txData, amount: safeAmount };
  const db = await openDatabase();
  try {
    const stores = cleanTx.linkedSavingEntryId
      ? [STORES.transactions, STORES.savingsEntries]
      : [STORES.transactions];

    await runTransaction(db, stores, 'readwrite', (idbTx) => {
      idbTx.objectStore(STORES.transactions).put(cleanTx);

      // Keep linked savings deposit synchronized if user edited the linked expense transaction
      if (cleanTx.linkedSavingEntryId) {
        const entryStore = idbTx.objectStore(STORES.savingsEntries);
        const getReq = entryStore.get(cleanTx.linkedSavingEntryId);
        getReq.onsuccess = () => {
          const existing = getReq.result as SavingsEntry | undefined;
          if (existing) {
            entryStore.put({
              ...existing,
              amount: cleanTx.amount,
              date: cleanTx.date,
              sourceAccountId: cleanTx.accountId ?? existing.sourceAccountId,
              notes: cleanTx.notes ?? existing.notes,
            });
          }
        };
      }
    });
  } finally {
    db.close();
  }
}

export async function deleteTransactionRecord(txRecord: Transaction): Promise<void> {
  const db = await openDatabase();
  try {
    const stores = txRecord.linkedSavingEntryId
      ? [STORES.transactions, STORES.savingsEntries]
      : [STORES.transactions];

    await runTransaction(db, stores, 'readwrite', (idbTx) => {
      idbTx.objectStore(STORES.transactions).delete(txRecord.id);
      if (txRecord.linkedSavingEntryId) {
        idbTx.objectStore(STORES.savingsEntries).delete(txRecord.linkedSavingEntryId);
      }
    });
  } finally {
    db.close();
  }
}

export async function saveAccountDisplayName(
  accountId: AccountId,
  displayName: string
): Promise<Account> {
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error('Nama akun tidak boleh kosong.');
  }
  const db = await openDatabase();
  try {
    const accounts = await getAllFromStore<Account>(db, STORES.accounts);
    const target = accounts.find((a) => a.id === accountId);
    if (!target) {
      throw new Error('Akun tidak ditemukan.');
    }
    const updated: Account = { ...target, displayName: trimmed };
    await runTransaction(db, [STORES.accounts], 'readwrite', (tx) => {
      tx.objectStore(STORES.accounts).put(updated);
    });
    return updated;
  } finally {
    db.close();
  }
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.categories], 'readwrite', (tx) => {
      tx.objectStore(STORES.categories).put({
        ...category,
        name: category.name.trim(),
      });
    });
  } finally {
    db.close();
  }
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.categories], 'readwrite', (tx) => {
      tx.objectStore(STORES.categories).delete(categoryId);
    });
  } finally {
    db.close();
  }
}

export async function saveBudget(budget: Budget): Promise<void> {
  const safeLimit = toSafeRupiah(budget.limitAmount);
  if (safeLimit <= 0) {
    throw new Error('Nominal anggaran harus lebih besar dari Rp0.');
  }
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.budgets], 'readwrite', (tx) => {
      tx.objectStore(STORES.budgets).put({ ...budget, limitAmount: safeLimit });
    });
  } finally {
    db.close();
  }
}

export async function deleteBudget(budgetId: string): Promise<void> {
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.budgets], 'readwrite', (tx) => {
      tx.objectStore(STORES.budgets).delete(budgetId);
    });
  } finally {
    db.close();
  }
}

export async function saveSavingsGoal(goal: SavingsGoal): Promise<void> {
  const safeTarget = toSafeRupiah(goal.targetAmount);
  if (safeTarget <= 0) {
    throw new Error('Target nominal tabungan harus lebih besar dari Rp0.');
  }
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.savingsGoals], 'readwrite', (tx) => {
      tx.objectStore(STORES.savingsGoals).put({ ...goal, targetAmount: safeTarget });
    });
  } finally {
    db.close();
  }
}

/**
 * Atomically records a savings deposit AND creates a linked expense transaction
 * on the chosen source account so the source account balance decreases cleanly
 * without double-counting.
 */
export async function addSavingsDeposit(params: {
  goal: SavingsGoal;
  sourceAccountId: AccountId;
  amount: number;
  date: string;
  notes?: string;
}): Promise<{ entry: SavingsEntry; transaction: Transaction }> {
  const safeAmount = toSafeRupiah(params.amount);
  if (safeAmount <= 0) {
    throw new Error('Nominal setoran tabungan harus lebih besar dari Rp0.');
  }

  const now = new Date().toISOString();
  const entryId = createId('sav_entry');
  const txId = createId('tx');

  const transaction: Transaction = {
    id: txId,
    date: params.date,
    type: 'expense',
    accountId: params.sourceAccountId,
    categoryId: SAVINGS_EXPENSE_CATEGORY_ID,
    amount: safeAmount,
    description: `Setoran Tabungan: ${params.goal.name}`,
    notes: params.notes?.trim() || undefined,
    linkedSavingEntryId: entryId,
    linkedSavingGoalId: params.goal.id,
    createdAt: now,
    updatedAt: now,
  };

  const entry: SavingsEntry = {
    id: entryId,
    goalId: params.goal.id,
    sourceAccountId: params.sourceAccountId,
    transactionId: txId,
    date: params.date,
    amount: safeAmount,
    notes: params.notes?.trim() || undefined,
    createdAt: now,
  };

  const db = await openDatabase();
  try {
    await runTransaction(
      db,
      [STORES.savingsEntries, STORES.transactions],
      'readwrite',
      (idbTx) => {
        idbTx.objectStore(STORES.savingsEntries).put(entry);
        idbTx.objectStore(STORES.transactions).put(transaction);
      }
    );
    return { entry, transaction };
  } finally {
    db.close();
  }
}

/**
 * Atomically deletes a savings deposit AND its linked expense transaction.
 */
export async function deleteSavingsDeposit(entry: SavingsEntry): Promise<void> {
  const db = await openDatabase();
  try {
    await runTransaction(
      db,
      [STORES.savingsEntries, STORES.transactions],
      'readwrite',
      (idbTx) => {
        idbTx.objectStore(STORES.savingsEntries).delete(entry.id);
        if (entry.transactionId) {
          idbTx.objectStore(STORES.transactions).delete(entry.transactionId);
        }
      }
    );
  } finally {
    db.close();
  }
}

/**
 * Atomically deletes a savings goal, all its deposit entries, and all linked expense transactions.
 */
export async function deleteSavingsGoalCascade(
  goalId: string,
  entries: SavingsEntry[]
): Promise<void> {
  const goalEntries = entries.filter((e) => e.goalId === goalId);
  const db = await openDatabase();
  try {
    await runTransaction(
      db,
      [STORES.savingsGoals, STORES.savingsEntries, STORES.transactions],
      'readwrite',
      (idbTx) => {
        idbTx.objectStore(STORES.savingsGoals).delete(goalId);
        const entryStore = idbTx.objectStore(STORES.savingsEntries);
        const txStore = idbTx.objectStore(STORES.transactions);
        for (const e of goalEntries) {
          entryStore.delete(e.id);
          if (e.transactionId) {
            txStore.delete(e.transactionId);
          }
        }
      }
    );
  } finally {
    db.close();
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await openDatabase();
  try {
    await runTransaction(db, [STORES.settings], 'readwrite', (tx) => {
      tx.objectStore(STORES.settings).put(settings);
    });
  } finally {
    db.close();
  }
}

/**
 * Atomically replaces all data in IndexedDB with validated restore state.
 * Never called before full JSON validation succeeds.
 */
export async function replaceAllData(state: FinanceState): Promise<void> {
  const db = await openDatabase();
  try {
    const allStores = [
      STORES.accounts,
      STORES.categories,
      STORES.transactions,
      STORES.budgets,
      STORES.savingsGoals,
      STORES.savingsEntries,
      STORES.settings,
    ];

    await runTransaction(db, allStores, 'readwrite', (tx) => {
      for (const storeName of allStores) {
        tx.objectStore(storeName).clear();
      }
      for (const acc of state.accounts) {
        tx.objectStore(STORES.accounts).put(acc);
      }
      for (const cat of state.categories) {
        tx.objectStore(STORES.categories).put(cat);
      }
      for (const item of state.transactions) {
        tx.objectStore(STORES.transactions).put(item);
      }
      for (const b of state.budgets) {
        tx.objectStore(STORES.budgets).put(b);
      }
      for (const g of state.savingsGoals) {
        tx.objectStore(STORES.savingsGoals).put(g);
      }
      for (const e of state.savingsEntries) {
        tx.objectStore(STORES.savingsEntries).put(e);
      }
      tx.objectStore(STORES.settings).put(state.settings);
    });
  } finally {
    db.close();
  }
}

/**
 * Resets user data back to an empty ledger while keeping accounts & default categories.
 */
export async function resetAllUserData(): Promise<FinanceState> {
  const cleanState: FinanceState = {
    accounts: DEFAULT_ACCOUNTS.map((a) => ({ ...a })),
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: [],
    budgets: [],
    savingsGoals: [],
    savingsEntries: [],
    settings: { ...DEFAULT_SETTINGS },
  };
  await replaceAllData(cleanState);
  return cleanState;
}
