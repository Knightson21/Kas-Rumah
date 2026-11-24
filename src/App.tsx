/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { TransactionModal } from './components/TransactionModal';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetPage } from './pages/BudgetPage';
import { ContributionPage } from './pages/ContributionPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReportsPage } from './pages/ReportsPage';
import { SavingsPage } from './pages/SavingsPage';
import { SettingsBackupPage } from './pages/SettingsBackupPage';
import { TransactionsPage } from './pages/TransactionsPage';
import type { NavSection } from './types/finance';

const AppContent: React.FC = () => {
  const { isLoading, loadError } = useFinance();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] p-6">
        <div className="w-full max-w-sm rounded-lg border border-[#E5E0D5] bg-white p-6 text-center">
          <p className="font-display text-base font-semibold text-[#1C1917]">Kas Rumah</p>
          <p className="mt-1 text-xs text-[#6B655D]">Membuka buku kas lokal di perangkat...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F5F0] p-6">
        <div className="w-full max-w-md rounded-lg border border-[#B42318]/30 bg-white p-6">
          <h1 className="font-display text-base font-semibold text-[#B42318]">
            Gagal Membuka Penyimpanan Lokal
          </h1>
          <p className="mt-2 text-sm text-[#6B655D]">{loadError}</p>
          <p className="mt-2 text-xs text-[#6B655D]">
            Pastikan browser tidak sedang dalam mode privat ketat yang memblokir IndexedDB.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout activeSection={activeSection} onNavigate={setActiveSection}>
        {activeSection === 'dashboard' && <DashboardPage onNavigate={setActiveSection} />}
        {activeSection === 'transaksi' && <TransactionsPage />}
        {activeSection === 'akun' && <AccountsPage />}
        {activeSection === 'kontribusi' && <ContributionPage />}
        {activeSection === 'anggaran' && <BudgetPage />}
        {activeSection === 'tabungan' && <SavingsPage />}
        {activeSection === 'laporan' && <ReportsPage />}
        {activeSection === 'pengaturan' && <SettingsBackupPage />}
      </Layout>

      <TransactionModal />
    </>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
