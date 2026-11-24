import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Pencil, RotateCcw, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateCombinedSummary,
  getAccountDisplayName,
  getCategoryName,
} from '../engine/calculations';
import type { AccountId, Transaction, TransactionType } from '../types/finance';
import { formatDateID, formatRupiah } from '../utils/format';

type SortOption = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';

export const TransactionsPage: React.FC = () => {
  const { state, openAddTxModal, openEditTxModal, removeTransaction } = useFinance();

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterAccount, setFilterAccount] = useState<'all' | AccountId>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredTransactions = useMemo(() => {
    if (!state) return [];
    const q = search.trim().toLowerCase();

    return state.transactions
      .filter((tx) => {
        if (filterType !== 'all' && tx.type !== filterType) return false;

        if (filterAccount !== 'all') {
          if (tx.type === 'transfer') {
            if (tx.fromAccountId !== filterAccount && tx.toAccountId !== filterAccount) {
              return false;
            }
          } else if (tx.accountId !== filterAccount) {
            return false;
          }
        }

        if (filterCategory !== 'all') {
          if (tx.type === 'transfer' || tx.categoryId !== filterCategory) return false;
        }

        if (dateFrom && tx.date < dateFrom) return false;
        if (dateTo && tx.date > dateTo) return false;

        if (q) {
          const catName = getCategoryName(state.categories, tx.categoryId).toLowerCase();
          const desc = (tx.description || '').toLowerCase();
          const notes = (tx.notes || '').toLowerCase();
          const accLabel =
            tx.type === 'transfer'
              ? `${getAccountDisplayName(state.accounts, tx.fromAccountId)} ${getAccountDisplayName(state.accounts, tx.toAccountId)}`.toLowerCase()
              : getAccountDisplayName(state.accounts, tx.accountId).toLowerCase();

          if (!desc.includes(q) && !notes.includes(q) && !catName.includes(q) && !accLabel.includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') {
          return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        }
        if (sortBy === 'date_asc') {
          return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        }
        if (sortBy === 'amount_desc') {
          return b.amount - a.amount || b.date.localeCompare(a.date);
        }
        return a.amount - b.amount || b.date.localeCompare(a.date);
      });
  }, [state, search, filterType, filterAccount, filterCategory, dateFrom, dateTo, sortBy]);

  const filteredSummary = useMemo(
    () => calculateCombinedSummary(filteredTransactions),
    [filteredTransactions]
  );

  if (!state) return null;

  const hasActiveFilters =
    search !== '' ||
    filterType !== 'all' ||
    filterAccount !== 'all' ||
    filterCategory !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '';

  const resetFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterAccount('all');
    setFilterCategory('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('date_desc');
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeTransaction(pendingDelete);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Filter Bar */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B655D]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari keterangan, kategori, akun, atau catatan..."
                className="w-full rounded-md border border-[#E5E0D5] bg-[#F7F5F0]/50 py-2 pl-9 pr-3 text-sm text-[#1C1917] placeholder:text-[#6B655D]/70 focus:border-[#1D3E5E] focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => openAddTxModal({ type: 'transfer', fromAccountId: 'suami', toAccountId: 'keluarga' })}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-white px-3.5 py-2 text-sm font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>Transfer Antar-Akun</span>
              </button>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-xs font-medium text-[#6B655D] hover:text-[#1C1917]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <select
              aria-label="Filter jenis transaksi"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'all' | TransactionType)}
              className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            >
              <option value="all">Semua Jenis</option>
              <option value="income">Pemasukan</option>
              <option value="expense">Pengeluaran</option>
              <option value="transfer">Transfer Antar-Akun</option>
            </select>

            <select
              aria-label="Filter akun"
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value as 'all' | AccountId)}
              className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            >
              <option value="all">Semua Akun</option>
              {state.accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.displayName}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter kategori"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            >
              <option value="all">Semua Kategori</option>
              {state.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              aria-label="Dari tanggal"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="font-num rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            />

            <input
              type="date"
              aria-label="Sampai tanggal"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="font-num rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            />

            <select
              aria-label="Urutkan transaksi"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-md border border-[#E5E0D5] bg-white px-3 py-2 text-xs text-[#1C1917] focus:border-[#1D3E5E] focus:outline-none"
            >
              <option value="date_desc">Tanggal Terbaru</option>
              <option value="date_asc">Tanggal Terlama</option>
              <option value="amount_desc">Nominal Terbesar</option>
              <option value="amount_asc">Nominal Terkecil</option>
            </select>
          </div>
        </div>
      </section>

      {/* Quiet Summary Strip for Filtered View */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[#E5E0D5] pb-3 text-xs text-[#6B655D]">
        <span>
          Menampilkan <strong className="font-num text-[#1C1917]">{filteredTransactions.length}</strong> transaksi
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Pemasukan:{' '}
          <strong className="font-num text-[#1F6E4A]">{formatRupiah(filteredSummary.totalIncome)}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Pengeluaran:{' '}
          <strong className="font-num text-[#B42318]">{formatRupiah(filteredSummary.totalExpense)}</strong>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          Transfer Internal:{' '}
          <strong className="font-num text-[#1D3E5E]">{formatRupiah(filteredSummary.totalTransfers)}</strong>
        </span>
      </div>

      {/* Transactions Ledger Table */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        {filteredTransactions.length === 0 ? (
          <EmptyState
            title={
              state.transactions.length === 0
                ? 'Belum ada transaksi tercatat'
                : 'Tidak ada transaksi yang cocok dengan filter'
            }
            description={
              state.transactions.length === 0
                ? 'Catat pemasukan, pengeluaran, atau transfer kontribusi antar-akun melalui tombol di bawah.'
                : 'Coba ubah kata kunci pencarian atau reset filter untuk melihat semua catatan.'
            }
            actionLabel={state.transactions.length === 0 ? 'Catat Transaksi Pertama' : 'Reset Filter'}
            onAction={state.transactions.length === 0 ? () => openAddTxModal() : resetFilters}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan & Kategori</th>
                  <th className="px-4 py-3">Jenis</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {filteredTransactions.map((tx) => {
                  const jenisLabel =
                    tx.type === 'income'
                      ? 'Pemasukan'
                      : tx.type === 'expense'
                        ? 'Pengeluaran'
                        : 'Transfer';

                  const accountDisplay =
                    tx.type === 'transfer'
                      ? `${getAccountDisplayName(state.accounts, tx.fromAccountId)} → ${getAccountDisplayName(state.accounts, tx.toAccountId)}`
                      : getAccountDisplayName(state.accounts, tx.accountId);

                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-[#F7F5F0]/60">
                      <td className="font-num whitespace-nowrap px-5 py-3.5 text-xs text-[#6B655D]">
                        {formatDateID(tx.date)}
                      </td>
                      <td className="max-w-xs px-4 py-3.5">
                        <div className="font-medium text-[#1C1917]">{tx.description}</div>
                        <div className="mt-0.5 text-xs text-[#6B655D]">
                          {tx.type === 'transfer'
                            ? tx.toAccountId === 'keluarga'
                              ? 'Kontribusi ke Kas Keluarga'
                              : 'Perpindahan Dana Antar-Akun'
                            : getCategoryName(state.categories, tx.categoryId)}
                          {tx.notes ? ` · ${tx.notes}` : ''}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs font-medium">
                        <span
                          className={
                            tx.type === 'income'
                              ? 'text-[#1F6E4A]'
                              : tx.type === 'expense'
                                ? 'text-[#B42318]'
                                : 'text-[#1D3E5E]'
                          }
                        >
                          {jenisLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-[#1C1917]">
                        {accountDisplay}
                      </td>
                      <td
                        className={`font-num whitespace-nowrap px-4 py-3.5 text-right font-medium ${
                          tx.type === 'income'
                            ? 'text-[#1F6E4A]'
                            : tx.type === 'expense'
                              ? 'text-[#B42318]'
                              : 'text-[#1D3E5E]'
                        }`}
                      >
                        {tx.type === 'income'
                          ? `+${formatRupiah(tx.amount)}`
                          : tx.type === 'expense'
                            ? `-${formatRupiah(tx.amount)}`
                            : formatRupiah(tx.amount)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTxModal(tx)}
                            className="rounded p-1.5 text-[#6B655D] transition-colors hover:bg-[#EFECE4] hover:text-[#1D3E5E]"
                            aria-label={`Ubah transaksi ${tx.description}`}
                            title="Ubah"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDelete(tx)}
                            className="rounded p-1.5 text-[#6B655D] transition-colors hover:bg-[#FCECEB] hover:text-[#B42318]"
                            aria-label={`Hapus transaksi ${tx.description}`}
                            title="Hapus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Hapus Transaksi Ini?"
        description={
          pendingDelete?.linkedSavingEntryId
            ? `Transaksi "${pendingDelete.description}" (${formatRupiah(pendingDelete.amount)}) tertaut dengan setoran Target Tabungan. Menghapusnya juga akan menghapus riwayat setoran di Target Tabungan dan mengembalikan saldo akun sumber.`
            : `Transaksi "${pendingDelete?.description ?? ''}" sebesar ${formatRupiah(pendingDelete?.amount ?? 0)} akan dihapus permanen dan saldo akun akan diperbarui otomatis.`
        }
        confirmLabel="Ya, Hapus Transaksi"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
        busy={deleting}
      />
    </div>
  );
};
