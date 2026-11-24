import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  addSavingsDeposit,
  deleteBudget,
  deleteCategory,
  deleteSavingsDeposit,
  deleteSavingsGoalCascade,
  deleteTransactionRecord,
  loadInitialState,
  replaceAllData,
  resetAllUserData,
  saveAccountDisplayName,
  saveBudget,
  saveCategory,
  saveSavingsGoal,
  saveSettings,
  saveTransaction,
} from '../db/indexedDb';
import type {
  AccountId,
  AppSettings,
  Budget,
  Category,
  FinanceState,
  SavingsEntry,
  SavingsGoal,
  Transaction,
  TransactionType,
} from '../types/finance';
import { downloadBackupJson } from '../utils/backup';
import { createId, toSafeRupiah } from '../utils/format';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

export interface TransactionModalPreset {
  type?: TransactionType;
  accountId?: AccountId;
  fromAccountId?: AccountId;
  toAccountId?: AccountId;
  description?: string;
}

interface FinanceContextValue {
  state: FinanceState | null;
  isLoading: boolean;
  loadError: string | null;
  toasts: ToastMessage[];
  dismissToast: (id: string) => void;
  pushToast: (text: string, tone?: ToastMessage['tone']) => void;

  // Transaction modal control
  isTxModalOpen: boolean;
  editingTx: Transaction | null;
  txPreset: TransactionModalPreset | null;
  openAddTxModal: (preset?: TransactionModalPreset) => void;
  openEditTxModal: (tx: Transaction) => void;
  closeTxModal: () => void;

  // CRUD actions
  upsertTransaction: (
    payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  removeTransaction: (tx: Transaction) => Promise<void>;
  renameAccount: (accountId: AccountId, displayName: string) => Promise<void>;
  upsertCategory: (payload: Omit<Category, 'id'>, existingId?: string) => Promise<void>;
  removeCategory: (categoryId: string) => Promise<void>;
  upsertBudget: (params: {
    categoryId: string;
    year: number;
    month: number;
    limitAmount: number;
    existingId?: string;
  }) => Promise<void>;
  removeBudget: (budgetId: string) => Promise<void>;
  upsertSavingsGoal: (
    payload: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>,
    existingId?: string
  ) => Promise<void>;
  removeSavingsGoal: (goalId: string) => Promise<void>;
  depositToSavings: (params: {
    goal: SavingsGoal;
    sourceAccountId: AccountId;
    amount: number;
    date: string;
    notes?: string;
  }) => Promise<void>;
  removeSavingsDeposit: (entry: SavingsEntry) => Promise<void>;
  exportBackup: () => Promise<void>;
  restoreFromState: (nextState: FinanceState) => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<FinanceState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txPreset, setTxPreset] = useState<TransactionModalPreset | null>(null);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((text: string, tone: ToastMessage['tone'] = 'success') => {
    const id = createId('toast');
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const refreshFromDb = useCallback(async () => {
    try {
      const loaded = await loadInitialState();
      setState(loaded);
      setLoadError(null);
    } catch (err) {
      setLoadError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat database lokal browser (IndexedDB).'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFromDb();
  }, [refreshFromDb]);

  const openAddTxModal = useCallback((preset?: TransactionModalPreset) => {
    setEditingTx(null);
    setTxPreset(preset ?? null);
    setIsTxModalOpen(true);
  }, []);

  const openEditTxModal = useCallback((tx: Transaction) => {
    setEditingTx(tx);
    setTxPreset(null);
    setIsTxModalOpen(true);
  }, []);

  const closeTxModal = useCallback(() => {
    setIsTxModalOpen(false);
    setEditingTx(null);
    setTxPreset(null);
  }, []);

  const upsertTransaction = useCallback(
    async (
      payload: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      const now = new Date().toISOString();
      const existing = existingId
        ? state?.transactions.find((t) => t.id === existingId)
        : undefined;

      const record: Transaction = {
        ...payload,
        amount: toSafeRupiah(payload.amount),
        id: existing?.id ?? createId('tx'),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        linkedSavingEntryId: existing?.linkedSavingEntryId ?? payload.linkedSavingEntryId,
        linkedSavingGoalId: existing?.linkedSavingGoalId ?? payload.linkedSavingGoalId,
      };

      await saveTransaction(record);
      await refreshFromDb();
      pushToast(existing ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil dicatat.');
    },
    [state, refreshFromDb, pushToast]
  );

  const removeTransaction = useCallback(
    async (tx: Transaction) => {
      await deleteTransactionRecord(tx);
      await refreshFromDb();
      pushToast('Transaksi berhasil dihapus.');
    },
    [refreshFromDb, pushToast]
  );

  const renameAccount = useCallback(
    async (accountId: AccountId, displayName: string) => {
      await saveAccountDisplayName(accountId, displayName);
      await refreshFromDb();
      pushToast('Nama tampilan akun berhasil diperbarui.');
    },
    [refreshFromDb, pushToast]
  );

  const upsertCategory = useCallback(
    async (payload: Omit<Category, 'id'>, existingId?: string) => {
      const record: Category = {
        ...payload,
        id: existingId ?? createId('cat'),
      };
      await saveCategory(record);
      await refreshFromDb();
      pushToast(existingId ? 'Kategori berhasil diperbarui.' : 'Kategori baru berhasil ditambahkan.');
    },
    [refreshFromDb, pushToast]
  );

  const removeCategory = useCallback(
    async (categoryId: string) => {
      await deleteCategory(categoryId);
      await refreshFromDb();
      pushToast('Kategori berhasil dihapus.');
    },
    [refreshFromDb, pushToast]
  );

  const upsertBudget = useCallback(
    async (params: {
      categoryId: string;
      year: number;
      month: number;
      limitAmount: number;
      existingId?: string;
    }) => {
      const existing =
        params.existingId
          ? state?.budgets.find((b) => b.id === params.existingId)
          : state?.budgets.find(
              (b) =>
                b.categoryId === params.categoryId &&
                b.year === params.year &&
                b.month === params.month
            );

      const record: Budget = {
        id: existing?.id ?? createId('bud'),
        categoryId: params.categoryId,
        year: params.year,
        month: params.month,
        limitAmount: toSafeRupiah(params.limitAmount),
        updatedAt: new Date().toISOString(),
      };
      await saveBudget(record);
      await refreshFromDb();
      pushToast('Anggaran bulanan berhasil disimpan.');
    },
    [state, refreshFromDb, pushToast]
  );

  const removeBudget = useCallback(
    async (budgetId: string) => {
      await deleteBudget(budgetId);
      await refreshFromDb();
      pushToast('Anggaran berhasil dihapus.');
    },
    [refreshFromDb, pushToast]
  );

  const upsertSavingsGoal = useCallback(
    async (
      payload: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>,
      existingId?: string
    ) => {
      const now = new Date().toISOString();
      const existing = existingId
        ? state?.savingsGoals.find((g) => g.id === existingId)
        : undefined;
      const record: SavingsGoal = {
        ...payload,
        targetAmount: toSafeRupiah(payload.targetAmount),
        id: existing?.id ?? createId('sav_goal'),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await saveSavingsGoal(record);
      await refreshFromDb();
      pushToast(existing ? 'Target tabungan diperbarui.' : 'Target tabungan baru dibuat.');
    },
    [state, refreshFromDb, pushToast]
  );

  const removeSavingsGoal = useCallback(
    async (goalId: string) => {
      if (!state) return;
      await deleteSavingsGoalCascade(goalId, state.savingsEntries);
      await refreshFromDb();
      pushToast('Target tabungan dan setoran tertaut dihapus.');
    },
    [state, refreshFromDb, pushToast]
  );

  const depositToSavings = useCallback(
    async (params: {
      goal: SavingsGoal;
      sourceAccountId: AccountId;
      amount: number;
      date: string;
      notes?: string;
    }) => {
      await addSavingsDeposit(params);
      await refreshFromDb();
      pushToast('Setoran tabungan berhasil dicatat dan mengurangi saldo akun sumber.');
    },
    [refreshFromDb, pushToast]
  );

  const removeSavingsDeposit = useCallback(
    async (entry: SavingsEntry) => {
      await deleteSavingsDeposit(entry);
      await refreshFromDb();
      pushToast('Riwayat setoran tabungan dihapus dan saldo akun sumber disesuaikan.');
    },
    [refreshFromDb, pushToast]
  );

  const exportBackup = useCallback(async () => {
    if (!state) return;
    const exportedAt = downloadBackupJson(state);
    const updatedSettings: AppSettings = {
      ...state.settings,
      lastBackupAt: exportedAt,
    };
    await saveSettings(updatedSettings);
    await refreshFromDb();
    pushToast('File backup JSON berhasil diunduh.');
  }, [state, refreshFromDb, pushToast]);

  const restoreFromState = useCallback(
    async (nextState: FinanceState) => {
      await replaceAllData(nextState);
      await refreshFromDb();
      pushToast('Data keuangan berhasil dipulihkan dari file backup.');
    },
    [refreshFromDb, pushToast]
  );

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      if (!state) return;
      const updated: AppSettings = { ...state.settings, ...partial, id: 'main' };
      await saveSettings(updated);
      await refreshFromDb();
      pushToast('Pengaturan berhasil disimpan.');
    },
    [state, refreshFromDb, pushToast]
  );

  const resetAllData = useCallback(async () => {
    const clean = await resetAllUserData();
    setState(clean);
    pushToast('Seluruh catatan transaksi, anggaran, dan tabungan telah dikosongkan.', 'info');
  }, [pushToast]);

  return (
    <FinanceContext.Provider
      value={{
        state,
        isLoading,
        loadError,
        toasts,
        dismissToast,
        pushToast,
        isTxModalOpen,
        editingTx,
        txPreset,
        openAddTxModal,
        openEditTxModal,
        closeTxModal,
        upsertTransaction,
        removeTransaction,
        renameAccount,
        upsertCategory,
        removeCategory,
        upsertBudget,
        removeBudget,
        upsertSavingsGoal,
        removeSavingsGoal,
        depositToSavings,
        removeSavingsDeposit,
        exportBackup,
        restoreFromState,
        updateSettings,
        resetAllData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance harus digunakan di dalam FinanceProvider.');
  }
  return ctx;
}
