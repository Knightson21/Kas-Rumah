import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useFinance } from '../context/FinanceContext';
import {
  calculateAccountBalances,
  calculateAccountSummaries,
  getAccountDisplayName,
  getCategoryName,
} from '../engine/calculations';
import type { AccountId } from '../types/finance';
import { formatDateID, formatRupiah, formatRupiahSigned } from '../utils/format';

export const AccountsPage: React.FC = () => {
  const { state, openAddTxModal } = useFinance();
  const [selectedAccount, setSelectedAccount] = useState<'all' | AccountId>('all');

  const summaries = useMemo(
    () => (state ? calculateAccountSummaries(state.transactions) : null),
    [state]
  );

  const balances = useMemo(
    () =>
      state
        ? calculateAccountBalances(state.transactions)
        : { suami: 0, istri: 0, keluarga: 0, total: 0 },
    [state]
  );

  const accountTransactions = useMemo(() => {
    if (!state) return [];
    return state.transactions
      .filter((tx) => {
        if (selectedAccount === 'all') return true;
        if (tx.type === 'transfer') {
          return tx.fromAccountId === selectedAccount || tx.toAccountId === selectedAccount;
        }
        return tx.accountId === selectedAccount;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [state, selectedAccount]);

  if (!state || !summaries) return null;

  return (
    <div className="space-y-8">
      {/* Three Separated Account Cards */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label="Daftar Tiga Akun Keuangan">
        {state.accounts.map((acc) => {
          const sum = summaries[acc.id];
          const isFamily = acc.id === 'keluarga';

          return (
            <div
              key={acc.id}
              className="flex flex-col justify-between rounded-lg border border-[#E5E0D5] bg-white p-6"
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-[#1C1917]">
                    {acc.displayName}
                  </h2>
                  <span className="text-xs text-[#6B655D]">
                    {sum.transactionCount} catatan
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#6B655D]">{acc.description}</p>

                <div className="mt-5 border-y border-[#E5E0D5] py-4">
                  <p className="text-xs text-[#6B655D]">Saldo Saat Ini</p>
                  <p
                    className={`font-num mt-1 text-2xl font-semibold ${
                      sum.balance < 0 ? 'text-[#B42318]' : 'text-[#1C1917]'
                    }`}
                  >
                    {formatRupiah(sum.balance)}
                  </p>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[#6B655D]">Pemasukan</dt>
                    <dd className="font-num mt-0.5 font-medium text-[#1F6E4A]">
                      {formatRupiah(sum.income)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#6B655D]">Pengeluaran</dt>
                    <dd className="font-num mt-0.5 font-medium text-[#B42318]">
                      {formatRupiah(sum.expense)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#6B655D]">Transfer Masuk</dt>
                    <dd className="font-num mt-0.5 font-medium text-[#1D3E5E]">
                      {formatRupiah(sum.transferIn)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#6B655D]">Transfer Keluar</dt>
                    <dd className="font-num mt-0.5 font-medium text-[#B68D40]">
                      {formatRupiah(sum.transferOut)}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Quick Account Actions */}
              <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E5E0D5] pt-4">
                <button
                  type="button"
                  onClick={() => openAddTxModal({ type: 'income', accountId: acc.id })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-xs font-medium text-[#1F6E4A] transition-colors hover:bg-[#EAF4EE]"
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  <span>Pemasukan</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddTxModal({ type: 'expense', accountId: acc.id })}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#E5E0D5] bg-[#F7F5F0] px-3 py-2 text-xs font-medium text-[#B42318] transition-colors hover:bg-[#FCECEB]"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>Pengeluaran</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openAddTxModal({
                      type: 'transfer',
                      fromAccountId: isFamily ? 'keluarga' : acc.id,
                      toAccountId: isFamily ? 'suami' : 'keluarga',
                    })
                  }
                  className="inline-flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#1D3E5E]/25 bg-white px-3 py-2 text-xs font-medium text-[#1D3E5E] transition-colors hover:bg-[#EFECE4]"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  <span>{isFamily ? 'Transfer dari Kas Keluarga' : 'Transfer ke Kas Keluarga'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {/* Combined Total Strip */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E0D5] bg-white px-6 py-4">
        <div>
          <p className="text-xs text-[#6B655D]">Total Gabungan Tiga Akun</p>
          <p className="font-num mt-0.5 text-xl font-semibold text-[#1D3E5E]">
            {formatRupiah(balances.total)}
          </p>
        </div>

        {/* Account Ledger Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#E5E0D5] bg-[#EFECE4] p-1">
          <button
            type="button"
            onClick={() => setSelectedAccount('all')}
            className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedAccount === 'all'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#6B655D] hover:text-[#1C1917]'
            }`}
          >
            Semua Akun
          </button>
          {state.accounts.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => setSelectedAccount(acc.id)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedAccount === acc.id
                  ? 'bg-white text-[#1C1917] shadow-xs'
                  : 'text-[#6B655D] hover:text-[#1C1917]'
              }`}
            >
              {acc.displayName}
            </button>
          ))}
        </div>
      </section>

      {/* Account Mutasi Table */}
      <section className="rounded-lg border border-[#E5E0D5] bg-white">
        <div className="border-b border-[#E5E0D5] px-6 py-4">
          <h2 className="font-display text-base font-semibold text-[#1C1917]">
            Mutasi{' '}
            {selectedAccount === 'all'
              ? 'Seluruh Akun'
              : getAccountDisplayName(state.accounts, selectedAccount)}
          </h2>
        </div>

        {accountTransactions.length === 0 ? (
          <EmptyState
            compact
            title="Belum ada mutasi pada akun ini"
            description="Catat pemasukan, pengeluaran, atau transfer untuk mulai melihat pergerakan saldo."
            actionLabel="Catat Transaksi"
            onAction={() =>
              openAddTxModal(
                selectedAccount === 'all' ? undefined : { accountId: selectedAccount }
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E0D5] bg-[#F7F5F0] text-xs font-medium text-[#6B655D]">
                <tr>
                  <th className="px-6 py-3">Tanggal</th>
                  <th className="px-4 py-3">Aktivitas</th>
                  <th className="px-4 py-3">Akun</th>
                  <th className="px-6 py-3 text-right">Perubahan Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E0D5]">
                {accountTransactions.map((tx) => {
                  let deltaDisplay = formatRupiah(tx.amount);
                  let deltaColor = 'text-[#1D3E5E]';

                  if (selectedAccount === 'all') {
                    if (tx.type === 'income') {
                      deltaDisplay = formatRupiahSigned(tx.amount);
                      deltaColor = 'text-[#1F6E4A]';
                    } else if (tx.type === 'expense') {
                      deltaDisplay = formatRupiahSigned(-tx.amount);
                      deltaColor = 'text-[#B42318]';
                    } else {
                      deltaDisplay = `${formatRupiah(tx.amount)} (Transfer)`;
                      deltaColor = 'text-[#1D3E5E]';
                    }
                  } else {
                    if (tx.type === 'income') {
                      deltaDisplay = formatRupiahSigned(tx.amount);
                      deltaColor = 'text-[#1F6E4A]';
                    } else if (tx.type === 'expense') {
                      deltaDisplay = formatRupiahSigned(-tx.amount);
                      deltaColor = 'text-[#B42318]';
                    } else if (tx.toAccountId === selectedAccount) {
                      deltaDisplay = formatRupiahSigned(tx.amount);
                      deltaColor = 'text-[#1F6E4A]';
                    } else {
                      deltaDisplay = formatRupiahSigned(-tx.amount);
                      deltaColor = 'text-[#B42318]';
                    }
                  }

                  return (
                    <tr key={tx.id} className="transition-colors hover:bg-[#F7F5F0]/60">
                      <td className="font-num whitespace-nowrap px-6 py-3 text-xs text-[#6B655D]">
                        {formatDateID(tx.date)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1C1917]">{tx.description}</div>
                        <div className="text-xs text-[#6B655D]">
                          {tx.type === 'transfer'
                            ? 'Transfer Antar-Akun'
                            : getCategoryName(state.categories, tx.categoryId)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[#6B655D]">
                        {tx.type === 'transfer'
                          ? `${getAccountDisplayName(state.accounts, tx.fromAccountId)} → ${getAccountDisplayName(state.accounts, tx.toAccountId)}`
                          : getAccountDisplayName(state.accounts, tx.accountId)}
                      </td>
                      <td className={`font-num whitespace-nowrap px-6 py-3 text-right font-medium ${deltaColor}`}>
                        {deltaDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
