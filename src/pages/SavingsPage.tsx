import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateAccountBalances,
  calculateSavingsProgress,
  getAccountDisplayName,
} from '../engine/calculations';
import type { AccountId, SavingsEntry, SavingsGoal } from '../types/finance';
import {
  formatDateID,
  formatInputThousands,
  formatPercent,
  formatRupiah,
  getTodayISO,
  parseRupiahInput,
} from '../utils/format';

export const SavingsPage: React.FC = () => {
  const {
    state,
    upsertSavingsGoal,
    removeSavingsGoal,
    depositToSavings,
    removeSavingsDeposit,
  } = useFinance();

  // Goal create/edit modal state
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalTargetDisplay, setGoalTargetDisplay] = useState('');
  const [goalStorageAccount, setGoalStorageAccount] = useState<AccountId>('keluarga');
  const [goalTargetDate, setGoalTargetDate] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [goalError, setGoalError] = useState<string | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);

  // Deposit modal state
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
  const [depositSource, setDepositSource] = useState<AccountId>('keluarga');
  const [depositAmountDisplay, setDepositAmountDisplay] = useState('');
  const [depositDate, setDepositDate] = useState(getTodayISO());
  const [depositNotes, setDepositNotes] = useState('');
  const [depositError, setDepositError] = useState<string | null>(null);
  const [savingDeposit, setSavingDeposit] = useState(false);

  // History expand & delete confirmations
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  const [pendingDeleteGoal, setPendingDeleteGoal] = useState<SavingsGoal | null>(null);
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<SavingsEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const progressList = useMemo(
    () => (state ? calculateSavingsProgress(state.savingsGoals, state.savingsEntries) : []),
    [state]
  );

  const balances = useMemo(
    () =>
      state
        ? calculateAccountBalances(state.transactions)
        : { suami: 0, istri: 0, keluarga: 0, total: 0 },
    [state]
  );

  const totals = useMemo(() => {
    const totalTarget = progressList.reduce((s, p) => s + p.goal.targetAmount, 0);
    const totalCollected = progressList.reduce((s, p) => s + p.collectedAmount, 0);
    const overallPercent = totalTarget > 0 ? Math.min(100, (totalCollected / totalTarget) * 100) : 0;
    return { totalTarget, totalCollected, overallPercent };
  }, [progressList]);

  if (!state) return null;

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalName('');
    setGoalTargetDisplay('');
    setGoalStorageAccount('keluarga');
    setGoalTargetDate('');
    setGoalNotes('');
    setGoalError(null);
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setGoalName(g.name);
    setGoalTargetDisplay(formatInputThousands(String(g.targetAmount)));
    setGoalStorageAccount(g.storageAccountId);
    setGoalTargetDate(g.targetDate ?? '');
    setGoalNotes(g.notes ?? '');
    setGoalError(null);
    setGoalModalOpen(true);
  };

  const openDepositModal = (g: SavingsGoal) => {
    setDepositGoal(g);
    setDepositSource(g.storageAccountId);
    setDepositAmountDisplay('');
    setDepositDate(getTodayISO());
    setDepositNotes('');
    setDepositError(null);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    setGoalError(null);
    const targetAmount = parseRupiahInput(goalTargetDisplay);
    if (!goalName.trim()) {
      setGoalError('Nama target tabungan wajib diisi.');
      return;
    }
    if (targetAmount <= 0) {
      setGoalError('Target nominal harus lebih besar dari Rp0.');
      return;
    }
    setSavingGoal(true);
    try {
      await upsertSavingsGoal(
        {
          name: goalName.trim(),
          targetAmount,
          storageAccountId: goalStorageAccount,
          targetDate: goalTargetDate || undefined,
          notes: goalNotes.trim() || undefined,
        },
        editingGoal?.id
      );
      setGoalModalOpen(false);
    } catch (err) {
      setGoalError(err instanceof Error ? err.message : 'Gagal menyimpan target tabungan.');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleSaveDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depositGoal) return;
    setDepositError(null);
    const amount = parseRupiahInput(depositAmountDisplay);
    if (amount <= 0) {
      setDepositError('Nominal setoran harus lebih besar dari Rp0.');
      return;
    }
    if (!depositDate) {
      setDepositError('Tanggal setoran wajib diisi.');
      return;
    }

    setSavingDeposit(true);
    try {
      await depositToSavings({
        goal: depositGoal,
        sourceAccountId: depositSource,
        amount,
        date: depositDate,
        notes: depositNotes.trim() || undefined,
      });
      setDepositGoal(null);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Gagal mencatat setoran tabungan.');
    } finally {
      setSavingDeposit(false);
    }
  };

  const handleConfirmDeleteGoal = async () => {
    if (!pendingDeleteGoal) return;
    setDeleting(true);
    try {
      await removeSavingsGoal(pendingDeleteGoal.id);
      setPendingDeleteGoal(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmDeleteEntry = async () => {
    if (!pendingDeleteEntry) return;
    setDeleting(true);
    try {
      await removeSavingsDeposit(pendingDeleteEntry);
      setPendingDeleteEntry(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-[#6B655D]">
          Setiap setoran ke target tabungan dicatat otomatis sebagai pengeluaran pada akun sumber
          sehingga saldo tersedia selalu akurat tanpa penghitungan ganda.
        </p>
        <button
          type="button"
          onClick={openNewGoal}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#1D3E5E] bg-white px-4 py-2 text-sm font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Target Tabungan</span>
        </button>
      </div>

      {/* Savings Summary Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Total Saldo Tabungan Terkumpul</p>
          <p className="font-num mt-1.5 text-2xl font-semibold text-[#1F6E4A]">
            {formatRupiah(totals.totalCollected)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Total Target Nominal</p>
          <p className="font-num mt-1.5 text-2xl font-semibold text-[#1C1917]">
            {formatRupiah(totals.totalTarget)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Pencapaian Keseluruhan</p>
          <p className="font-num mt-1.5 text-2xl font-semibold text-[#1D3E5E]">
            {formatPercent(totals.overallPercent)}
          </p>
        </div>
      </section>

      {/* Savings Goals Grid / List */}
      {progressList.length === 0 ? (
        <section className="rounded-lg border border-[#E5E0D5] bg-white">
          <EmptyState
            title="Belum ada target tabungan"
            description="Buat target seperti Dana Darurat, Dana Pendidikan, Renovasi Rumah, atau Liburan Keluarga untuk memantau pencapaian tabungan bersama."
            actionLabel="Buat Target Pertama"
            onAction={openNewGoal}
          />
        </section>
      ) : (
        <section className="space-y-4">
          {progressList.map(({ goal, collectedAmount, remainingAmount, percentage, entries }) => {
            const isExpanded = expandedGoalId === goal.id;
            const reached = collectedAmount >= goal.targetAmount;

            return (
              <div key={goal.id} className="rounded-lg border border-[#E5E0D5] bg-white">
                <div className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-[#1C1917]">
                        {goal.name}
                      </h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#6B655D]">
                        <span>Akun: {getAccountDisplayName(state.accounts, goal.storageAccountId)}</span>
                        {goal.targetDate && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Target: {formatDateID(goal.targetDate)}</span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>{entries.length} setoran</span>
                        {reached && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#1F6E4A]">Target Tercapai</span>
                          </>
                        )}
                      </div>
                      {goal.notes && (
                        <p className="mt-2 text-xs text-[#6B655D]">{goal.notes}</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openDepositModal(goal)}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-[#1D3E5E] px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-[#142D46]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Tambah Dana</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs font-medium text-[#1C1917] hover:bg-[#EFECE4]"
                      >
                        <span>Riwayat</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditGoal(goal)}
                        className="rounded-md border border-[#E5E0D5] p-2 text-[#6B655D] hover:bg-[#EFECE4] hover:text-[#1D3E5E]"
                        aria-label={`Ubah target ${goal.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteGoal(goal)}
                        className="rounded-md border border-[#E5E0D5] p-2 text-[#6B655D] hover:bg-[#FCECEB] hover:text-[#B42318]"
                        aria-label={`Hapus target ${goal.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Bar & Tabular Values */}
                  <div className="mt-5">
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-num font-semibold text-[#1C1917]">
                        {formatRupiah(collectedAmount)}{' '}
                        <span className="font-normal text-[#6B655D]">
                          dari {formatRupiah(goal.targetAmount)}
                        </span>
                      </span>
                      <span className="font-num text-[#6B655D]">
                        <strong className="text-[#1D3E5E]">{formatPercent(percentage)}</strong>
                        {remainingAmount > 0 ? ` · Sisa ${formatRupiah(remainingAmount)}` : ''}
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-xs bg-[#EFECE4]">
                      <div
                        className={`h-full transition-all ${
                          reached ? 'bg-[#1F6E4A]' : 'bg-[#1D3E5E]'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Expandable Deposit History */}
                {isExpanded && (
                  <div className="border-t border-[#E5E0D5] bg-[#F7F5F0]/60 px-6 py-4">
                    <h3 className="text-xs font-semibold text-[#1C1917]">
                      Riwayat Penambahan Dana
                    </h3>
                    {entries.length === 0 ? (
                      <p className="mt-2 text-xs text-[#6B655D]">
                        Belum ada setoran dana untuk target ini.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-[#E5E0D5] text-[#6B655D]">
                            <tr>
                              <th className="py-2 pr-4">Tanggal</th>
                              <th className="py-2 pr-4">Akun Sumber</th>
                              <th className="py-2 pr-4">Catatan</th>
                              <th className="py-2 pr-4 text-right">Nominal</th>
                              <th className="py-2 text-right">Hapus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E5E0D5]">
                            {entries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="font-num py-2.5 pr-4 text-[#6B655D]">
                                  {formatDateID(entry.date)}
                                </td>
                                <td className="py-2.5 pr-4 font-medium text-[#1C1917]">
                                  {getAccountDisplayName(state.accounts, entry.sourceAccountId)}
                                </td>
                                <td className="py-2.5 pr-4 text-[#6B655D]">
                                  {entry.notes || '-'}
                                </td>
                                <td className="font-num py-2.5 pr-4 text-right font-semibold text-[#1F6E4A]">
                                  +{formatRupiah(entry.amount)}
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setPendingDeleteEntry(entry)}
                                    className="rounded p-1 text-[#6B655D] hover:bg-[#FCECEB] hover:text-[#B42318]"
                                    aria-label="Hapus riwayat setoran"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Goal Create / Edit Modal */}
      {goalModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E5E0D5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E0D5] px-6 py-4">
              <h2 className="font-display text-base font-semibold text-[#1C1917]">
                {editingGoal ? 'Ubah Target Tabungan' : 'Buat Target Tabungan Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setGoalModalOpen(false)}
                className="rounded p-1 text-[#6B655D] hover:bg-[#EFECE4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4 p-6">
              <div>
                <label htmlFor="sg-name" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                  Nama Target
                </label>
                <input
                  id="sg-name"
                  type="text"
                  placeholder="Contoh: Dana Darurat, Dana Pendidikan"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  required
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sg-target" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                    Target Nominal (Rp)
                  </label>
                  <div className="relative">
                    <span className="font-num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B655D]">
                      Rp
                    </span>
                    <input
                      id="sg-target"
                      type="text"
                      inputMode="numeric"
                      placeholder="10.000.000"
                      value={goalTargetDisplay}
                      onChange={(e) => setGoalTargetDisplay(formatInputThousands(e.target.value))}
                      required
                      className="font-num w-full rounded-md border border-[#E5E0D5] bg-white py-2 pl-9 pr-3 text-right text-sm font-medium text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="sg-date" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                    Tanggal Target (Opsional)
                  </label>
                  <input
                    id="sg-date"
                    type="date"
                    value={goalTargetDate}
                    onChange={(e) => setGoalTargetDate(e.target.value)}
                    className="font-num w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sg-acc" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                  Akun Penyimpanan Utama
                </label>
                <select
                  id="sg-acc"
                  value={goalStorageAccount}
                  onChange={(e) => setGoalStorageAccount(e.target.value as AccountId)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                >
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="sg-notes" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                  Catatan (Opsional)
                </label>
                <textarea
                  id="sg-notes"
                  rows={2}
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  className="w-full resize-none rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                />
              </div>

              {goalError && <p className="text-xs font-medium text-[#B42318]">{goalError}</p>}

              <div className="flex justify-end gap-2 border-t border-[#E5E0D5] pt-4">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="rounded-md border border-[#E5E0D5] px-4 py-2 text-sm font-medium text-[#6B655D] hover:bg-[#EFECE4]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white hover:bg-[#142D46] disabled:opacity-60"
                >
                  {savingGoal ? 'Menyimpan...' : 'Simpan Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Deposit Modal */}
      {depositGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1917]/45 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-[#E5E0D5] bg-white">
            <div className="flex items-center justify-between border-b border-[#E5E0D5] px-6 py-4">
              <h2 className="font-display text-base font-semibold text-[#1C1917]">
                Tambah Dana — {depositGoal.name}
              </h2>
              <button
                type="button"
                onClick={() => setDepositGoal(null)}
                className="rounded p-1 text-[#6B655D] hover:bg-[#EFECE4]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeposit} className="space-y-4 p-6">
              <div>
                <label htmlFor="dep-src" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                  Ambil Dana dari Akun Sumber
                </label>
                <select
                  id="dep-src"
                  value={depositSource}
                  onChange={(e) => setDepositSource(e.target.value as AccountId)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                >
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.displayName} (Saldo: {formatRupiah(balances[acc.id])})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="dep-date" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                    Tanggal Setoran
                  </label>
                  <input
                    id="dep-date"
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    required
                    className="font-num w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="dep-amt" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                    Nominal Setoran (Rp)
                  </label>
                  <div className="relative">
                    <span className="font-num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B655D]">
                      Rp
                    </span>
                    <input
                      id="dep-amt"
                      type="text"
                      inputMode="numeric"
                      placeholder="500.000"
                      value={depositAmountDisplay}
                      onChange={(e) => setDepositAmountDisplay(formatInputThousands(e.target.value))}
                      required
                      className="font-num w-full rounded-md border border-[#E5E0D5] bg-white py-2 pl-9 pr-3 text-right text-sm font-medium text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="dep-notes" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                  Catatan (Opsional)
                </label>
                <input
                  id="dep-notes"
                  type="text"
                  placeholder="Contoh: Sisihan bulan ini"
                  value={depositNotes}
                  onChange={(e) => setDepositNotes(e.target.value)}
                  className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                />
              </div>

              <p className="rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-xs leading-relaxed text-[#6B655D]">
                Setoran ini akan dicatat otomatis sebagai pengeluaran berkategori{' '}
                <strong className="text-[#1C1917]">Setoran Tabungan</strong> pada akun sumber
                terpilih sehingga saldo kas tersedia langsung berkurang secara akurat.
              </p>

              {depositError && <p className="text-xs font-medium text-[#B42318]">{depositError}</p>}

              <div className="flex justify-end gap-2 border-t border-[#E5E0D5] pt-4">
                <button
                  type="button"
                  onClick={() => setDepositGoal(null)}
                  className="rounded-md border border-[#E5E0D5] px-4 py-2 text-sm font-medium text-[#6B655D] hover:bg-[#EFECE4]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDeposit}
                  className="rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white hover:bg-[#142D46] disabled:opacity-60"
                >
                  {savingDeposit ? 'Menyimpan...' : 'Catat Setoran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteGoal)}
        title="Hapus Target Tabungan?"
        description={`Target "${pendingDeleteGoal?.name ?? ''}" beserta seluruh riwayat setorannya akan dihapus, dan transaksi pengeluaran yang tertaut akan ikut dihapus sehingga saldo akun sumber kembali seperti semula.`}
        confirmLabel="Ya, Hapus Target"
        onConfirm={handleConfirmDeleteGoal}
        onCancel={() => setPendingDeleteGoal(null)}
        busy={deleting}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteEntry)}
        title="Hapus Riwayat Setoran Tabungan?"
        description={`Setoran sebesar ${formatRupiah(pendingDeleteEntry?.amount ?? 0)} beserta transaksi pengeluaran tertaut di akun sumber akan dihapus.`}
        confirmLabel="Ya, Hapus Setoran"
        onConfirm={handleConfirmDeleteEntry}
        onCancel={() => setPendingDeleteEntry(null)}
        busy={deleting}
      />
    </div>
  );
};
