import React, { useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  ReceiptText,
  Scale,
  Settings,
  Wallet,
  WifiOff,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useOnlineStatus } from '../hooks/usePWA';
import type { NavSection } from '../types/finance';
import { isBackupReminderDue } from '../utils/backup';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transaksi', label: 'Transaksi', icon: ReceiptText },
  { id: 'akun', label: 'Akun', icon: Wallet },
  { id: 'kontribusi', label: 'Kontribusi Keluarga', icon: ArrowLeftRight },
  { id: 'anggaran', label: 'Anggaran', icon: Scale },
  { id: 'tabungan', label: 'Tabungan', icon: PiggyBank },
  { id: 'laporan', label: 'Laporan', icon: BarChart3 },
  { id: 'pengaturan', label: 'Pengaturan & Backup', icon: Settings },
];

interface LayoutProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeSection, onNavigate, children }) => {
  const { state, openAddTxModal, toasts, dismissToast } = useFinance();
  const isOnline = useOnlineStatus();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];
  const backupDue = state
    ? isBackupReminderDue(state.settings, state.transactions.length)
    : false;

  const handleSelectNav = (id: NavSection) => {
    onNavigate(id);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-white">
      {/* Brand Lockup — single clean line with architectural emblem */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#E5E0D5] px-5">
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          className="flex items-center gap-2.5 text-left"
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" fill="none" aria-hidden="true">
            <rect width="32" height="32" rx="6" fill="#1D3E5E" />
            <path d="M7 15.5L16 8.5L25 15.5" stroke="#B68D40" strokeWidth="2" strokeLinecap="square" />
            <path d="M10.5 15.5V23.5H21.5V15.5" stroke="#F7F5F0" strokeWidth="1.6" />
            <line x1="16" y1="16.5" x2="16" y2="21.5" stroke="#B68D40" strokeWidth="1.8" />
          </svg>
          <span className="font-display whitespace-nowrap text-base font-semibold tracking-tight text-[#1C1917]">
            Kas Rumah
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-md p-1.5 text-[#6B655D] hover:bg-[#EFECE4] lg:hidden"
          aria-label="Tutup navigasi"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 8 Main Menu Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Menu Utama">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex w-full items-center gap-3 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#EFECE4] text-[#1D3E5E]'
                  : 'text-[#6B655D] hover:bg-[#F7F5F0] hover:text-[#1C1917]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? 'text-[#1D3E5E]' : 'text-[#6B655D]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quiet Local Backup Reminder (only shown when reminder is genuinely due) */}
      <div className="border-t border-[#E5E0D5] px-4 py-3.5">
        {backupDue ? (
          <button
            type="button"
            onClick={() => handleSelectNav('pengaturan')}
            className="w-full rounded-md border border-[#B68D40]/40 bg-[#F6F0E2] px-3 py-2.5 text-left transition-colors hover:bg-[#EFE5CC]"
          >
            <p className="text-xs font-semibold text-[#1C1917]">Waktunya Backup Data</p>
            <p className="mt-0.5 text-xs text-[#6B655D]">
              Simpan cadangan JSON agar catatan lokal tetap aman.
            </p>
          </button>
        ) : (
          <p className="text-xs leading-relaxed text-[#6B655D]">
            Tersimpan lokal di perangkat ini tanpa koneksi server.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#F7F5F0] text-[#1C1917]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#E5E0D5] lg:fixed lg:inset-y-0 lg:left-0 lg:block">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#1C1917]/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-50 w-64 max-w-[82vw] border-r border-[#E5E0D5] bg-white">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Strict One-Row Top Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E5E0D5] bg-[#F7F5F0]/95 px-4 backdrop-blur-xs sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md border border-[#E5E0D5] bg-white p-2 text-[#1C1917] transition-colors hover:bg-[#EFECE4] lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="font-display truncate text-lg font-semibold text-[#1C1917] sm:text-xl">
              {activeNav.label}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => openAddTxModal()}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#1D3E5E] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#142D46]"
          >
            <Plus className="h-4 w-4" />
            <span>Catat Transaksi</span>
          </button>
        </header>

        {/* Page Viewport */}
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>

      {/* Real Offline Connectivity Indicator (only visible when browser is offline) */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-md border border-[#B4690E]/30 bg-[#FDF5E6] px-3 py-2 text-xs font-medium text-[#B4690E]"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Mode Offline — Data tersimpan aman di perangkat</span>
        </div>
      )}

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className={`flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-sm ${
                toast.tone === 'error'
                  ? 'border-[#B42318]/25 bg-[#FCECEB] text-[#B42318]'
                  : toast.tone === 'info'
                    ? 'border-[#1D3E5E]/25 bg-white text-[#1C1917]'
                    : 'border-[#1F6E4A]/25 bg-[#EAF4EE] text-[#1F6E4A]'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 opacity-70 hover:opacity-100"
                aria-label="Tutup pemberitahuan"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
