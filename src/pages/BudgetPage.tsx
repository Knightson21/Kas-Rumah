import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import { calculateBudgetStatuses, getAvailableYears } from '../engine/calculations';
import type { Budget } from '../types/finance';
import {
  formatInputThousands,
  formatMonthYearID,
  formatPercent,
  formatRupiah,
  getCurrentYearMonth,
  MONTH_NAMES_ID,
  parseRupiahInput,
} from '../utils/format';

export const BudgetPage: React.FC = () => {
  const { state, upsertBudget, removeBudget } = useFinance();
  const current = getCurrentYearMonth();

  const [selectedYear, setSelectedYear] = useState<number>(current.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(current.month);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [limitDisplay, setLimitDisplay] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Budget | null>(null);
  const [deleting, setDeleting] = useState(false);

  const availableYears = useMemo(
    () => (state ? getAvailableYears(state.transactions, state.budgets) : [current.year]),
    [state, current.year]
  );

  const expenseCategories = useMemo(
    () => (state ? state.categories.filter((c) => c.type === 'expense') : []),
    [state]
  );

  const budgetRows = useMemo(
    () =>
      state
        ? calculateBudgetStatuses(
            state.budgets,
            state.transactions,
            state.categories,
            selectedYear,
            selectedMonth
          )
        : [],
    [state, selectedYear, selectedMonth]
  );

  const totals = useMemo(() => {
    const totalLimit = budgetRows.reduce((s, r) => s + r.limitAmount, 0);
    const totalSpent = budgetRows.reduce((s, r) => s + r.spentAmount, 0);
    const totalRemaining = totalLimit - totalSpent;
    const totalPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    return { totalLimit, totalSpent, totalRemaining, totalPercent };
  }, [budgetRows]);

  if (!state) return null;

  const openAddForm = () => {
    setEditingBudget(null);
    const usedIds = new Set(budgetRows.map((r) => r.budget.categoryId));
    const firstUnused =
      expenseCategories.find((c) => !usedIds.has(c.id)) ?? expenseCategories[0];
    setCategoryId(firstUnused?.id ?? '');
    setLimitDisplay('');
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (b: Budget) => {
    setEditingBudget(b);
    setCategoryId(b.categoryId);
    setLimitDisplay(formatInputThousands(String(b.limitAmount)));
    setFormError(null);
    setFormOpen(true);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = parseRupiahInput(limitDisplay);
    if (!categoryId) {
      setFormError('Pilih kategori pengeluaran terlebih dahulu.');
      return;
    }
    if (amount <= 0) {
      setFormError('Nominal anggaran harus lebih besar dari Rp0.');
      return;
    }

    setSaving(true);
    try {
      await upsertBudget({
        categoryId,
        year: selectedYear,
        month: selectedMonth,
        limitAmount: amount,
        existingId: editingBudget?.id,
      });
      setFormOpen(false);
      setEditingBudget(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeBudget(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Period Selector & Add Budget CTA */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Pilih bulan anggaran"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
          >
            {MONTH_NAMES_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Pilih tahun anggaran"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="font-num rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#1D3E5E] bg-white px-4 py-2 text-sm font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
        >
          <Plus className="h-4 w-4" />
          <span>Atur Anggaran Kategori</span>
        </button>
      </div>

      {/* Inline Add / Edit Form */}
      {formOpen && (
        <section className="rounded-lg border border-[#1D3E5E]/30 bg-white p-6">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            {editingBudget ? 'Ubah Batas Anggaran' : 'Tambah Anggaran Bulanan'} —{' '}
            {formatMonthYearID(selectedYear, selectedMonth)}
          </h2>
          <form onSubmit={handleSaveBudget} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label htmlFor="bud-cat" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                Kategori Pengeluaran
              </label>
              <select
                id="bud-cat"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                disabled={Boolean(editingBudget)}
                className="w-full rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-sm text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none disabled:bg-[#F7F5F0]"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="bud-limit" className="mb-1.5 block text-xs font-medium text-[#6B655D]">
                Batas Anggaran (Rp)
              </label>
              <div className="relative">
                <span className="font-num pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B655D]">
                  Rp
                </span>
                <input
                  id="bud-limit"
                  type="text"
                  inputMode="numeric"
                  placeholder="1.500.000"
                  value={limitDisplay}
                  onChange={(e) => setLimitDisplay(formatInputThousands(e.target.value))}
                  required
                  className="font-num w-full rounded-md border border-[#E5E0D5] bg-white py-2 pl-9 pr-3 text-right text-sm font-medium text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#142D46] disabled:opacity-60"
              >
                {saving ? 'Menyimpan...' : 'Simpan Anggaran'}
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-4 py-2 text-sm font-medium text-[#6B655D] hover:bg-[#EFECE4]"
              >
                Batal
              </button>
            </div>
          </form>
          {formError && <p className="mt-3 text-xs font-medium text-[#B42318]">{formError}</p>}
        </section>
      )}

      {/* Summary Metrics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Total Anggaran</p>
          <p className="font-num mt-1.5 text-xl font-semibold text-[#1C1917]">
            {formatRupiah(totals.totalLimit)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Realisasi Pengeluaran</p>
          <p className="font-num mt-1.5 text-xl font-semibold text-[#B42318]">
            {formatRupiah(totals.totalSpent)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Sisa Anggaran</p>
          <p
            className={`font-num mt-1.5 text-xl font-semibold ${
              totals.totalRemaining < 0 ? 'text-[#B42318]' : 'text-[#1F6E4A]'
            }`}
          >
            {formatRupiah(totals.totalRemaining)}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E0D5] bg-white p-5">
          <p className="text-xs text-[#6B655D]">Penggunaan Keseluruhan</p>
          <p className="font-num mt-1.5 text-xl font-semibold text-[#1D3E5E]">
            {formatPercent(totals.totalPercent)}
          </p>
        </div>
      </section>

      {/* Budget List */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Daftar Anggaran — {formatMonthYearID(selectedYear, selectedMonth)}
          </h2>
        </div>

        {budgetRows.length === 0 ? (
          <EmptyState
            title={`Belum ada anggaran untuk ${formatMonthYearID(selectedYear, selectedMonth)}`}
            description="Tetapkan batas pengeluaran per kategori seperti Belanja Dapur, Listrik dan Air, atau Transportasi agar penggunaan dana lebih terkontrol."
            actionLabel="Atur Anggaran Pertama"
            onAction={openAddForm}
          />
        ) : (
          <div className="divide-y divide-[#E5E0D5]">
            {budgetRows.map((row) => {
              const clampedWidth = Math.min(100, Math.max(0, row.percentage));
              const statusLabel =
                row.status === 'terlampaui'
                  ? 'Terlampaui'
                  : row.status === 'hampir_habis'
                    ? 'Hampir Habis'
                    : 'Aman';
              const statusColor =
                row.status === 'terlampaui'
                  ? 'text-[#B42318]'
                  : row.status === 'hampir_habis'
                    ? 'text-[#B4690E]'
                    : 'text-[#1F6E4A]';
              const barColor =
                row.status === 'terlampaui'
                  ? 'bg-[#B42318]'
                  : row.status === 'hampir_habis'
                    ? 'bg-[#B4690E]'
                    : 'bg-[#1F6E4A]';

              return (
                <div key={row.budget.id} className="p-5 transition-colors hover:bg-[#F7F5F0]/50">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[#1C1917]">{row.categoryName}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#6B655D]">
                        <span className={`font-semibold ${statusColor}`}>{statusLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Terpakai <strong className="font-num text-[#1C1917]">{formatPercent(row.percentage)}</strong>
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          Sisa:{' '}
                          <strong
                            className={`font-num ${
                              row.remainingAmount < 0 ? 'text-[#B42318]' : 'text-[#1C1917]'
                            }`}
                          >
                            {formatRupiah(row.remainingAmount)}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="font-num text-right text-xs">
                        <span className="font-semibold text-[#1C1917]">
                          {formatRupiah(row.spentAmount)}
                        </span>
                        <span className="text-[#6B655D]"> / {formatRupiah(row.limitAmount)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(row.budget)}
                          className="rounded p-1.5 text-[#6B655D] hover:bg-[#EFECE4] hover:text-[#1D3E5E]"
                          aria-label={`Ubah anggaran ${row.categoryName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(row.budget)}
                          className="rounded p-1.5 text-[#6B655D] hover:bg-[#FCECEB] hover:text-[#B42318]"
                          aria-label={`Hapus anggaran ${row.categoryName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-2 w-full overflow-hidden rounded-xs bg-[#EFECE4]">
                    <div
                      className={`h-full transition-all ${barColor}`}
                      style={{ width: `${clampedWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus Anggaran Kategori?"
        description="Batas anggaran untuk kategori ini akan dihapus. Riwayat transaksi pengeluaran Anda tidak ikut terhapus."
        confirmLabel="Ya, Hapus Anggaran"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </div>
  );
};
