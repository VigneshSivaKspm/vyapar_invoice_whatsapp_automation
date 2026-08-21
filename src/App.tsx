import { useState, useEffect } from "react";
import { isConfigured, getAllCustomers, getCustomerInvoices } from "./firebase";
import type { CustomerDoc, InvoiceDoc } from "./firebase";

// ─── Types ──────────────────────────────────────────────────────────────────

type Page = "dashboard" | "invoices" | "customers" | "campaigns" | "settings";

interface Invoice {
  id: string;
  invoiceNo: string;
  customer: string;
  mobile: string;
  amount: number;
  date: string;
  status: "SENT" | "PENDING" | "FAILED" | "DUPLICATE";
  sentAt?: string;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: "DRAFT" | "SENT" | "SENDING";
  recipients: number;
  sentAt?: string;
  createdAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INVOICES: Invoice[] = [
  { id: "1", invoiceNo: "INV-1031", customer: "Vignesh Kumar", mobile: "9876543210", amount: 4850, date: "21 Aug 2026", status: "SENT", sentAt: "21 Aug 2026, 10:42 AM" },
  { id: "2", invoiceNo: "INV-1030", customer: "Priya Lakshmi", mobile: "9845012378", amount: 12200, date: "21 Aug 2026", status: "SENT", sentAt: "21 Aug 2026, 09:15 AM" },
  { id: "3", invoiceNo: "INV-1029", customer: "Ramesh Babu", mobile: "9003421567", amount: 3400, date: "21 Aug 2026", status: "FAILED" },
  { id: "4", invoiceNo: "INV-1028", customer: "Kavitha Devi", mobile: "8925631470", amount: 7600, date: "20 Aug 2026", status: "SENT", sentAt: "20 Aug 2026, 06:30 PM" },
  { id: "5", invoiceNo: "INV-1027", customer: "Suresh Annamalai", mobile: "9841256789", amount: 950, date: "20 Aug 2026", status: "PENDING" },
  { id: "6", invoiceNo: "INV-1026", customer: "Meena Sundaram", mobile: "7845612390", amount: 21500, date: "20 Aug 2026", status: "SENT", sentAt: "20 Aug 2026, 04:12 PM" },
  { id: "7", invoiceNo: "INV-1025", customer: "Arjun Selvam", mobile: "9962341570", amount: 1000, date: "19 Aug 2026", status: "DUPLICATE" },
  { id: "8", invoiceNo: "INV-1024", customer: "Deepa Krishnan", mobile: "9500112345", amount: 8750, date: "19 Aug 2026", status: "SENT", sentAt: "19 Aug 2026, 11:58 AM" },
  { id: "9", invoiceNo: "INV-1023", customer: "Murugan Pillai", mobile: "9385671234", amount: 5300, date: "18 Aug 2026", status: "SENT", sentAt: "18 Aug 2026, 03:22 PM" },
  { id: "10", invoiceNo: "INV-1022", customer: "Anitha Raghavan", mobile: "8807451236", amount: 16400, date: "18 Aug 2026", status: "FAILED" },
  { id: "11", invoiceNo: "INV-1019", customer: "Vignesh Kumar", mobile: "9876543210", amount: 2200, date: "15 Aug 2026", status: "SENT", sentAt: "15 Aug 2026, 11:00 AM" },
  { id: "12", invoiceNo: "INV-1015", customer: "Priya Lakshmi", mobile: "9845012378", amount: 8400, date: "10 Aug 2026", status: "SENT", sentAt: "10 Aug 2026, 02:30 PM" },
  { id: "13", invoiceNo: "INV-1010", customer: "Deepa Krishnan", mobile: "9500112345", amount: 3300, date: "05 Aug 2026", status: "SENT", sentAt: "05 Aug 2026, 09:45 AM" },
  { id: "14", invoiceNo: "INV-1008", customer: "Murugan Pillai", mobile: "9385671234", amount: 11200, date: "03 Aug 2026", status: "SENT", sentAt: "03 Aug 2026, 05:10 PM" },
  { id: "15", invoiceNo: "INV-1002", customer: "Kavitha Devi", mobile: "8925631470", amount: 4900, date: "28 Jul 2026", status: "SENT", sentAt: "28 Jul 2026, 03:00 PM" },
];

// Derive customers from invoices (mirrors what Firebase would store)
function deriveCustomers(): CustomerDoc[] {
  const map = new Map<string, CustomerDoc>();
  for (const inv of INVOICES) {
    const existing = map.get(inv.mobile);
    if (existing) {
      existing.totalInvoices += 1;
      existing.totalSpend += inv.amount;
      if (inv.date > existing.lastInvoiceDate) existing.lastInvoiceDate = inv.date;
    } else {
      map.set(inv.mobile, {
        id: inv.mobile,
        name: inv.customer,
        mobile: inv.mobile,
        totalInvoices: 1,
        totalSpend: inv.amount,
        lastInvoiceDate: inv.date,
        createdAt: inv.date,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastInvoiceDate.localeCompare(a.lastInvoiceDate));
}

const MOCK_CUSTOMERS = deriveCustomers();

const CAMPAIGNS: Campaign[] = [
  { id: "1", name: "Independence Day 2026", message: "Happy Independence Day, {{customer_name}}! 🇮🇳\nWishing you and your family a proud 79th Independence Day.\nVisit our store for special offers this week.\n\nThank you for your continued support!", status: "SENT", recipients: 284, sentAt: "15 Aug 2026, 08:00 AM", createdAt: "14 Aug 2026" },
  { id: "2", name: "Onam Special Offer", message: "Happy Onam, {{customer_name}}! 🌸\nWishing you a wonderful Onam festival.\nEnjoy special discounts on all products this Onam season.\n\nThank you for shopping with us!", status: "DRAFT", recipients: 0, createdAt: "20 Aug 2026" },
  { id: "3", name: "Pongal 2026", message: "Iniya Pongal Vaazhthukkal, {{customer_name}}! 🌾\nWishing you happiness and prosperity this Pongal.\nVisit our store for Pongal special offers.", status: "SENT", recipients: 198, sentAt: "14 Jan 2026, 07:30 AM", createdAt: "12 Jan 2026" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Invoice["status"] }) {
  const map = {
    SENT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
    DUPLICATE: "bg-slate-500/15 text-slate-400 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${map[status]}`}>
      <span className={`size-1.5 rounded-full ${status === "SENT" ? "bg-emerald-400" : status === "PENDING" ? "bg-amber-400" : status === "FAILED" ? "bg-red-400" : "bg-slate-400"}`} />
      {status}
    </span>
  );
}

function CampaignBadge({ status }: { status: Campaign["status"] }) {
  const map = {
    SENT: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    DRAFT: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    SENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${map[status]}`}>
      {status}
    </span>
  );
}

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const colors = ["#25d366", "#128c7e", "#34b7f1", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sizeClass = size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0`} style={{ background: color + "25", color }}>
      {initials}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const Icons = {
  dashboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  invoices: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  customers: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  campaigns: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.64 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  whatsapp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  ),
  agent: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  retry: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  ),
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  send: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  search: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  back: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  firebase: () => (
    <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor">
      <path d="M19.62 11.558l-3.203 2.98-2.972-5.995 1.538-3.448c.4-.7 1.024-.692 1.414 0z" fill="#ffa000" />
      <path d="M13.445 8.543l2.972 5.995-11.97 11.135z" fill="#f57f17" />
      <path d="M23.123 7.003c.572-.55 1.164-.362 1.315.417l3.116 18.105-10.328 6.2c-.36.2-1.32.286-1.32.286s-.874-.104-1.207-.3L4.447 25.673z" fill="#ffca28" />
      <path d="M13.445 8.543l-9 17.13L7.86 4.87c.15-.78.732-.968 1.305-.42z" fill="#ffa000" />
    </svg>
  ),
  phone: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.64 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  ),
  edit: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  folder: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  close: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  const nav: { id: Page; label: string; icon: () => React.ReactNode }[] = [
    { id: "dashboard", label: "Dashboard", icon: Icons.dashboard },
    { id: "invoices", label: "Invoice History", icon: Icons.invoices },
    { id: "customers", label: "Customers", icon: Icons.customers },
    { id: "campaigns", label: "Campaigns", icon: Icons.campaigns },
    { id: "settings", label: "Settings", icon: Icons.settings },
  ];

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen sticky top-0 border-r border-[#30363d] p-4" style={{ background: "#161b22" }}>
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-8 px-2">
        <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, #25d366, #128c7e)" }}>
          <Icons.whatsapp />
        </div>
        <div>
          <div className="text-sm font-bold text-white leading-tight">Invoice Auto</div>
          <div className="text-[10px] text-slate-500 leading-tight">Automation System</div>
        </div>
      </div>

      {/* Agent Status */}
      <div className="rounded-lg border border-emerald-500/20 px-3 py-2 mb-6" style={{ background: "#0d2b1a" }}>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Agent Online</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5 font-mono">Monitoring D:\Invoices</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5">
        {nav.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${page === id ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            style={page === id ? { background: "#25d36620", color: "#25d366" } : {}}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>

    </aside>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({ setPage }: { setPage: (p: Page) => void }) {
  const stats = [
    { label: "Total Invoices", value: "1,031", sub: "All time", color: "#e6edf3" },
    { label: "Sent Today", value: "2", sub: "Via WhatsApp", color: "#25d366" },
    { label: "Pending", value: "1", sub: "Awaiting network", color: "#f6a800" },
    { label: "Failed", value: "2", sub: "Need retry", color: "#f85149" },
  ];

  const recentActivity = INVOICES.slice(0, 5);

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">Thursday, 21 August 2026</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(s => (
          <div key={s.label} className="rounded-xl border border-[#30363d] p-4" style={{ background: "#161b22" }}>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">{s.label}</div>
            <div className="text-3xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Customer summary card */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <button
          onClick={() => setPage("customers")}
          className="rounded-xl border border-[#30363d] p-5 text-left hover:border-[#25d366]/40 transition-colors group"
          style={{ background: "#161b22" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Customers</div>
            <span className="text-xs text-[#25d366] opacity-0 group-hover:opacity-100 transition-opacity">View all →</span>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{MOCK_CUSTOMERS.length}</div>
          <div className="text-xs text-slate-500">Unique customers in Firebase</div>
          <div className="mt-3 flex -space-x-2">
            {MOCK_CUSTOMERS.slice(0, 5).map(c => (
              <Avatar key={c.id} name={c.name} size="sm" />
            ))}
            <div className="size-7 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-400 border border-[#30363d]" style={{ background: "#21262d" }}>
              +{MOCK_CUSTOMERS.length - 5}
            </div>
          </div>
        </button>

        <div className="lg:col-span-2 rounded-xl border border-[#30363d] p-5" style={{ background: "#161b22" }}>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">New Customers — Auto-Detected</div>
          <div className="space-y-2">
            {MOCK_CUSTOMERS.filter(c => c.totalInvoices === 1).slice(0, 3).map(c => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ background: "#21262d" }}>
                <Avatar name={c.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white font-medium truncate">{c.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{c.mobile}</div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400" style={{ background: "#0d2b1a" }}>New</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="rounded-xl border border-[#30363d] overflow-hidden" style={{ background: "#161b22" }}>
        <div className="px-5 py-3.5 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Recent Activity</span>
          <span className="text-xs text-slate-500">Latest 5 invoices</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#30363d]">
              {["Invoice", "Customer", "Amount", "Status"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentActivity.map((inv, i) => (
              <tr key={inv.id} className={`hover:bg-white/2 transition-colors ${i < recentActivity.length - 1 ? "border-b border-[#30363d]" : ""}`}>
                <td className="px-5 py-3 font-mono text-xs text-slate-300">{inv.invoiceNo}</td>
                <td className="px-5 py-3 text-slate-200">{inv.customer}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-300">₹{inv.amount.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Invoice History Page ─────────────────────────────────────────────────────

function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | Invoice["status"]>("ALL");
  const [retrying, setRetrying] = useState<string | null>(null);

  const filtered = INVOICES.filter(inv => {
    const matchSearch = search === "" || inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) || inv.customer.toLowerCase().includes(search.toLowerCase()) || inv.mobile.includes(search);
    const matchFilter = filter === "ALL" || inv.status === filter;
    return matchSearch && matchFilter;
  });

  function handleRetry(id: string) {
    setRetrying(id);
    setTimeout(() => setRetrying(null), 2000);
  }

  const counts = {
    ALL: INVOICES.length,
    SENT: INVOICES.filter(i => i.status === "SENT").length,
    PENDING: INVOICES.filter(i => i.status === "PENDING").length,
    FAILED: INVOICES.filter(i => i.status === "FAILED").length,
    DUPLICATE: INVOICES.filter(i => i.status === "DUPLICATE").length,
  };

  return (
    <div className="p-6 lg:p-8 space-y-5 w-full">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoice History</h1>
        <p className="text-sm text-slate-400 mt-0.5">{INVOICES.length} invoices · Auto-detected from Vyapar · Stored in Firebase</p>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Segmented Tab Filter */}
        <div className="inline-flex items-center gap-1 p-1 rounded-xl border border-[#30363d]" style={{ background: "#161b22" }}>
          {(["ALL", "SENT", "PENDING", "FAILED", "DUPLICATE"] as const).map(s => {
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`flex items-center px-3.5 py-1.5 rounded-lg text-xs transition-all ${
                  isActive
                    ? "bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/40 font-semibold shadow-xs"
                    : "text-slate-400 hover:text-white hover:bg-[#21262d] border border-transparent font-medium"
                }`}
              >
                <span>{s}</span>
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold ${
                    isActive ? "bg-[#25d366]/25 text-[#25d366]" : "bg-[#30363d] text-slate-400"
                  }`}
                >
                  {counts[s]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Bar on Right */}
        <div className="relative w-full sm:w-72">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icons.search /></span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice, customer, mobile…"
            className="w-full pl-9.5 pr-4 py-2 rounded-xl text-sm text-white placeholder:text-slate-500 outline-none border border-[#30363d] focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/20 transition-all font-mono"
            style={{ background: "#161b22" }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#30363d] overflow-hidden" style={{ background: "#161b22" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#30363d]">
              {["Invoice No", "Customer", "Mobile", "Amount", "Date", "Status", "Action"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((inv, i) => (
              <tr key={inv.id} className={`hover:bg-white/2 transition-colors ${i < filtered.length - 1 ? "border-b border-[#21262d]" : ""}`}>
                <td className="px-4 py-3 font-mono text-xs text-emerald-400">{inv.invoiceNo}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={inv.customer} size="sm" />
                    <span className="text-slate-200 font-medium">{inv.customer}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{inv.mobile}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-300">₹{inv.amount.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{inv.date}</td>
                <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-4 py-3">
                  {inv.status === "FAILED" && (
                    <button
                      onClick={() => handleRetry(inv.id)}
                      disabled={retrying === inv.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    >
                      <Icons.retry />
                      {retrying === inv.id ? "Retrying…" : "Retry"}
                    </button>
                  )}
                  {inv.status === "SENT" && (
                    <span className="text-[10px] text-slate-600 font-mono">{inv.sentAt}</span>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500 text-sm">No invoices match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Customer Detail ──────────────────────────────────────────────────────────

function CustomerDetail({ customer, onBack }: { customer: CustomerDoc; onBack: () => void }) {
  const [fbInvoices, setFbInvoices] = useState<InvoiceDoc[] | null>(null);

  useEffect(() => {
    if (isConfigured) {
      getCustomerInvoices(customer.mobile).then(setFbInvoices);
    }
  }, [customer.mobile]);

  const localInvoices = INVOICES.filter(i => i.mobile === customer.mobile);
  const displayInvoices = fbInvoices
    ? fbInvoices
    : localInvoices.map(i => ({
        id: i.id,
        invoiceNo: i.invoiceNo,
        customerId: i.mobile,
        customerName: i.customer,
        mobile: i.mobile,
        amount: i.amount,
        invoiceDate: i.date,
        status: i.status,
        createdAt: i.date,
        sentAt: i.sentAt,
      } as InvoiceDoc));

  const totalSpend = localInvoices.reduce((s, i) => s + i.amount, 0);
  const sentCount = localInvoices.filter(i => i.status === "SENT").length;

  return (
    <div className="p-6 lg:p-8 space-y-5 w-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-2">
        <Icons.back />
        Back to Customers
      </button>

      {/* Profile card */}
      <div className="rounded-xl border border-[#30363d] p-6" style={{ background: "#161b22" }}>
        <div className="flex items-start gap-4">
          <Avatar name={customer.name} size="lg" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{customer.name}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-400">
              <Icons.phone />
              <span className="font-mono">{customer.mobile}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">Customer since {customer.createdAt}</div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/20 text-xs text-amber-400 font-medium" style={{ background: "#2d1a00" }}>
            <Icons.firebase />
            Firestore
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[#30363d]">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Invoices</div>
            <div className="text-2xl font-bold text-white">{localInvoices.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Total Spend</div>
            <div className="text-2xl font-bold text-[#25d366]">₹{totalSpend.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">WhatsApp Sent</div>
            <div className="text-2xl font-bold text-white">{sentCount}</div>
          </div>
        </div>
      </div>

      {/* Firebase path */}
      <div className="rounded-lg border border-[#30363d] px-4 py-3 font-mono text-xs text-slate-500 flex items-center gap-2" style={{ background: "#161b22" }}>
        <Icons.firebase />
        <span>firestore / customers / <span className="text-amber-400">{customer.mobile}</span></span>
      </div>

      {/* Invoice history */}
      <div className="rounded-xl border border-[#30363d] overflow-hidden" style={{ background: "#161b22" }}>
        <div className="px-5 py-3.5 border-b border-[#30363d] flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Invoice History</span>
          <span className="text-xs text-slate-500">{displayInvoices.length} invoices</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#30363d]">
              {["Invoice No", "Amount", "Date", "Status", "Sent At"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayInvoices.map((inv, i) => (
              <tr key={inv.id} className={`hover:bg-white/2 transition-colors ${i < displayInvoices.length - 1 ? "border-b border-[#21262d]" : ""}`}>
                <td className="px-5 py-3 font-mono text-xs text-emerald-400">{inv.invoiceNo}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-300">₹{inv.amount.toLocaleString("en-IN")}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{inv.invoiceDate}</td>
                <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-5 py-3 text-[10px] text-slate-600 font-mono">{inv.sentAt ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Customers Page ───────────────────────────────────────────────────────────

function CustomersPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CustomerDoc | null>(null);
  const [fbCustomers, setFbCustomers] = useState<CustomerDoc[] | null>(null);
  const [loadingFb, setLoadingFb] = useState(false);

  useEffect(() => {
    if (isConfigured) {
      setLoadingFb(true);
      getAllCustomers().then(data => { setFbCustomers(data); setLoadingFb(false); });
    }
  }, []);

  const customers = fbCustomers ?? MOCK_CUSTOMERS;

  const filtered = customers.filter(c =>
    search === "" ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile.includes(search)
  );

  if (selected) return <CustomerDetail customer={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="p-6 lg:p-8 space-y-5 w-full">
      <div>
        <h1 className="text-2xl font-bold text-white">Customers</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          {customers.length} total customer records
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icons.search /></span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or mobile number…"
          className="pl-9 pr-4 py-2 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] transition-colors w-72"
          style={{ background: "#161b22" }}
        />
      </div>

      {loadingFb && (
        <div className="text-sm text-slate-500 text-center py-8">Loading from Firebase…</div>
      )}

      {/* Customer Full Width Table / List View */}
      <div className="rounded-xl border border-[#30363d] overflow-hidden" style={{ background: "#161b22" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#30363d]">
              {["Customer Name", "Mobile Number", "Total Invoices", "Total Spend", "Last Invoice Date", "Firestore Path", "Action"].map(h => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#21262d]">
            {filtered.map(c => {
              const invoiceCount = INVOICES.filter(i => i.mobile === c.mobile).length;
              const spend = INVOICES.filter(i => i.mobile === c.mobile).reduce((s, i) => s + i.amount, 0);
              const isNew = invoiceCount === 1;
              return (
                <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-[#25d366]/5 transition-colors cursor-pointer group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white group-hover:text-[#25d366] transition-colors">{c.name}</span>
                          {isNew && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 text-emerald-400" style={{ background: "#0d2b1a" }}>New</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Icons.phone />
                      {c.mobile}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs font-bold text-white">
                    {invoiceCount}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs font-bold text-[#25d366]">
                    ₹{spend.toLocaleString("en-IN")}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">
                    {c.lastInvoiceDate}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500">
                    /customers/{c.mobile}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-right">
                    <span className="text-slate-400 group-hover:text-[#25d366] font-medium flex items-center gap-1 justify-end">
                      View Detail →
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 text-sm">No customers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Quick Templates Data Structure ──────────────────────────────────────────

interface QuickTemplate {
  id: string;
  name: string;
  category: string;
  message: string;
}

const DEFAULT_QUICK_TEMPLATES: QuickTemplate[] = [
  {
    id: "qt-1",
    name: "Deepavali Special",
    category: "Festival",
    message: "Happy Deepavali, {{customer_name}}!\nWishing you and your family a very Happy Diwali.\n\nVisit our store for special Diwali offers up to 30% off on all items.\nThank you for shopping with us!"
  },
  {
    id: "qt-2",
    name: "Pongal Greetings",
    category: "Festival",
    message: "Happy Pongal, {{customer_name}}!\nMay this harvest festival bring prosperity and joy to your home.\n\nEnjoy our exclusive Pongal festive discounts this week!"
  },
  {
    id: "qt-3",
    name: "Ramzan Mubarak",
    category: "Festival",
    message: "Ramzan Mubarak, {{customer_name}}!\nWishing you blessings, health, and peace during this holy month.\n\nSpecial festive collections now available at our store."
  },
  {
    id: "qt-4",
    name: "Christmas & New Year",
    category: "Holiday",
    message: "Merry Christmas & Happy New Year, {{customer_name}}!\nThank you for your valued support throughout the year.\n\nHere is a 15% discount voucher on your next purchase!"
  },
  {
    id: "qt-5",
    name: "Independence Day Sale",
    category: "National",
    message: "Happy Independence Day, {{customer_name}}!\nCelebrating freedom with grand savings across all categories.\n\nVisit us today!"
  },
  {
    id: "qt-6",
    name: "VIP Store Discount",
    category: "Promotion",
    message: "Hello {{customer_name}}!\nAs our valued VIP customer, enjoy an exclusive 20% cashback on your next invoice.\n\nOffer valid till this weekend!"
  }
];

// ─── Campaigns Page ───────────────────────────────────────────────────────────

function CampaignsPage() {
  const [view, setView] = useState<"list" | "create">("list");
  const [form, setForm] = useState({ name: "", message: "", recipients: "ALL" });
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // Stateful Quick Templates with LocalStorage persistence
  const [templates, setTemplates] = useState<QuickTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("vyapar_quick_templates");
      return saved ? JSON.parse(saved) : DEFAULT_QUICK_TEMPLATES;
    } catch {
      return DEFAULT_QUICK_TEMPLATES;
    }
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<QuickTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({ name: "", category: "Festival", message: "" });

  function saveTemplates(updated: QuickTemplate[]) {
    setTemplates(updated);
    try {
      localStorage.setItem("vyapar_quick_templates", JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  }

  function handleOpenAddModal() {
    setEditingTemplate(null);
    setTemplateForm({ name: "", category: "Festival", message: "" });
    setModalOpen(true);
  }

  function handleOpenEditModal(t: QuickTemplate, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingTemplate(t);
    setTemplateForm({ name: t.name, category: t.category || "Festival", message: t.message });
    setModalOpen(true);
  }

  function handleDeleteTemplate(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this template?")) {
      const updated = templates.filter(t => t.id !== id);
      saveTemplates(updated);
    }
  }

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.message.trim()) return;

    if (editingTemplate) {
      const updated = templates.map(t =>
        t.id === editingTemplate.id ? { ...t, name: templateForm.name, category: templateForm.category, message: templateForm.message } : t
      );
      saveTemplates(updated);
    } else {
      const newT: QuickTemplate = {
        id: `qt-${Date.now()}`,
        name: templateForm.name,
        category: templateForm.category || "General",
        message: templateForm.message,
      };
      saveTemplates([...templates, newT]);
    }
    setModalOpen(false);
  }

  function applyQuickTemplate(t: QuickTemplate) {
    setForm({ ...form, name: t.name, message: t.message });
    setView("create");
  }

  function handleSend() {
    setSending(true);
    setTimeout(() => { setSending(false); setSent(true); }, 2000);
  }

  const previewMessage = form.message.replace("{{customer_name}}", "Vignesh Kumar");

  if (view === "create") {
    return (
      <div className="p-6 lg:p-8 space-y-5 w-full">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView("list"); setSent(false); setPreview(false); }} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
            <Icons.back />
            Back
          </button>
          <h1 className="text-2xl font-bold text-white">New Campaign</h1>
        </div>

        {sent ? (
          <div className="rounded-xl border border-emerald-500/30 p-8 text-center" style={{ background: "#0d2b1a" }}>
            <div className="text-4xl mb-3">✅</div>
            <div className="text-lg font-bold text-emerald-400 mb-1">Campaign Sent!</div>
            <div className="text-sm text-slate-400">WhatsApp messages are being delivered to {form.recipients === "ALL" ? "all customers" : "selected customers"}.</div>
            <button onClick={() => { setView("list"); setSent(false); }} className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-[#0d1117] transition-opacity" style={{ background: "#25d366" }}>View Campaigns</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#30363d] p-5 space-y-4" style={{ background: "#161b22" }}>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Campaign Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Deepavali 2026" className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] transition-colors" style={{ background: "#0d1117" }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                  Message <span className="normal-case text-slate-600">· Use {"{{customer_name}}"} for personalization</span>
                </label>
                <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={6}
                  placeholder={"Happy Deepavali, {{customer_name}}!\nWishing you and your family a very Happy Diwali.\n\nVisit our store for special Diwali offers.\nThank you for shopping with us!"}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] transition-colors resize-none font-mono" style={{ background: "#0d1117" }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Recipients</label>
                <select value={form.recipients} onChange={e => setForm({ ...form, recipients: e.target.value })} className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] transition-colors" style={{ background: "#0d1117" }}>
                  <option value="ALL">All Customers ({MOCK_CUSTOMERS.length})</option>
                  <option value="RECENT">Recent — Last 30 days (6)</option>
                  <option value="CUSTOM">Custom Selection</option>
                </select>
              </div>
            </div>

            {form.message && (
              <div className="rounded-xl border border-[#30363d] p-5" style={{ background: "#161b22" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Preview</div>
                  <button onClick={() => setPreview(!preview)} className="text-xs text-[#25d366] hover:underline">{preview ? "Hide" : "Show"} Preview</button>
                </div>
                {preview && (
                  <div className="rounded-xl p-4 max-w-xs text-sm text-slate-900 whitespace-pre-line leading-relaxed" style={{ background: "#dcf8c6", fontFamily: "'Outfit', sans-serif" }}>
                    <div className="font-medium mb-1 text-xs text-slate-600">My Store · WhatsApp</div>
                    {previewMessage}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={handleSend} disabled={!form.name || !form.message || sending} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0d1117] transition-opacity disabled:opacity-40" style={{ background: "#25d366" }}>
                <Icons.send />
                {sending ? "Sending…" : "Send Campaign"}
              </button>
              <button onClick={() => setView("list")} className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 border border-[#30363d] hover:border-slate-500 transition-colors" style={{ background: "#161b22" }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-5 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <p className="text-sm text-slate-400 mt-0.5">Festival & promotional WhatsApp messages</p>
        </div>
        <button onClick={() => setView("create")} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-[#0d1117]" style={{ background: "#25d366" }}>
          <Icons.plus />
          New Campaign
        </button>
      </div>

      {/* Editable & Addable Quick Templates Section */}
      <div className="rounded-xl border border-[#30363d] p-5 space-y-4" style={{ background: "#161b22" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Quick Templates</div>
            <div className="text-xs text-slate-500 mt-0.5">Click any template to populate a campaign, or edit/add custom templates</div>
          </div>
          <button onClick={handleOpenAddModal} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#25d366] border border-[#25d366]/30 hover:bg-[#25d366]/10 transition-colors">
            <Icons.plus />
            Add Template
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => (
            <div key={t.id} onClick={() => applyQuickTemplate(t)} className="group relative rounded-xl border border-[#30363d] hover:border-[#25d366] p-4 transition-all cursor-pointer flex flex-col justify-between" style={{ background: "#21262d" }}>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#30363d] text-emerald-400 font-semibold">{t.category}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button title="Edit Template" onClick={(e) => handleOpenEditModal(t, e)} className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]">
                      <Icons.edit />
                    </button>
                    <button title="Delete Template" onClick={(e) => handleDeleteTemplate(t.id, e)} className="p-1 text-slate-400 hover:text-red-400 rounded hover:bg-[#30363d]">
                      <Icons.trash />
                    </button>
                  </div>
                </div>
                <div className="font-semibold text-white text-sm mb-1">{t.name}</div>
                <p className="text-xs text-slate-400 line-clamp-2 font-mono" style={{ whiteSpace: "pre-line" }}>{t.message}</p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#30363d]/60 flex items-center justify-between text-[11px] text-[#25d366] font-medium">
                <span>Use Template →</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Quick Template Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-[#30363d] p-6 space-y-4 shadow-2xl" style={{ background: "#161b22" }}>
            <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
              <h3 className="text-lg font-bold text-white">
                {editingTemplate ? "Edit Quick Template" : "Add New Quick Template"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <Icons.close />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Template Name</label>
                <input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g. Diwal Special / Cashback Offer" className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366]" style={{ background: "#0d1117" }} required />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Category</label>
                <input value={templateForm.category} onChange={e => setTemplateForm({ ...templateForm, category: e.target.value })} placeholder="e.g. Festival, Holiday, Promotion" className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366]" style={{ background: "#0d1117" }} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                  Message Content <span className="normal-case text-slate-500">· Use {"{{customer_name}}"}</span>
                </label>
                <textarea value={templateForm.message} onChange={e => setTemplateForm({ ...templateForm, message: e.target.value })} rows={5} placeholder="Happy festival {{customer_name}}! Visit our store for grand offers..." className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] resize-none font-mono" style={{ background: "#0d1117" }} required />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-[#30363d] hover:border-slate-500">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-[#0d1117]" style={{ background: "#25d366" }}>
                  {editingTemplate ? "Update Template" : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Sent & Draft Campaigns</div>
        {CAMPAIGNS.map(c => (
          <div key={c.id} className="rounded-xl border border-[#30363d] p-5" style={{ background: "#161b22" }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-semibold text-white">{c.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">Created {c.createdAt}</div>
              </div>
              <CampaignBadge status={c.status} />
            </div>
            <p className="text-xs text-slate-400 line-clamp-2 font-mono mb-3" style={{ whiteSpace: "pre-line" }}>{c.message}</p>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              {c.status === "SENT" && (
                <>
                  <span><span className="text-white font-medium">{c.recipients}</span> recipients</span>
                  <span>Sent {c.sentAt}</span>
                </>
              )}
              {c.status === "DRAFT" && <span className="text-amber-400">Not yet sent</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage() {
  // Folder target settings state with LocalStorage persistence
  const [folder, setFolder] = useState(() => {
    return localStorage.getItem("vyapar_agent_invoice_folder") || "D:\\Vyapar\\Invoices";
  });
  const [watchInterval, setWatchInterval] = useState(() => {
    return localStorage.getItem("vyapar_watch_interval") || "5";
  });
  const [includeSubfolders, setIncludeSubfolders] = useState(() => {
    return localStorage.getItem("vyapar_subfolders") !== "false";
  });
  const [fileTypes, setFileTypes] = useState({ pdf: true, xlsx: true, csv: false });

  const [saved, setSaved] = useState(false);

  // Folder Browser Modal state
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browserCurrentPath, setBrowserCurrentPath] = useState(folder);

  // Test scan status state
  const [testingAccess, setTestingAccess] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; filesFound: number } | null>(null);

  const presetFolders = [
    "D:\\Vyapar\\Invoices",
    "C:\\Users\\Public\\Documents\\Vyapar\\Invoices",
    "C:\\Users\\Store\\Downloads\\Vyapar_Invoices",
    "D:\\Billing\\Automated_Invoices",
  ];

  function handleTestFolderAccess() {
    setTestingAccess(true);
    setTestResult(null);
    setTimeout(() => {
      setTestingAccess(false);
      setTestResult({
        success: true,
        message: `Folder verified! Agent has full read & write permissions on target directory.`,
        filesFound: 24,
      });
    }, 1000);
  }

  function handleSave() {
    localStorage.setItem("vyapar_agent_invoice_folder", folder);
    localStorage.setItem("vyapar_watch_interval", watchInterval);
    localStorage.setItem("vyapar_subfolders", String(includeSubfolders));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 w-full">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Background Agent & invoice folder targeting configuration</p>
      </div>

      {/* Automation Workflow */}
      <div className="rounded-xl border border-[#30363d] p-5" style={{ background: "#161b22" }}>
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Automation Workflow</div>
        <div className="flex items-center gap-0 overflow-x-auto">
          {[
            { icon: "📄", label: "Vyapar", sub: "Generate bill" },
            { icon: "💾", label: "Download", sub: "Invoice PDF" },
            { icon: "🤖", label: "Agent", sub: "Detect & extract" },
            { icon: "⚙️", label: "Backend", sub: "Process & check" },
            { icon: "🔥", label: "Firebase", sub: "Store customer" },
            { icon: "💬", label: "WhatsApp", sub: "Send invoice" },
          ].map((step, i) => (
            <div key={step.label} className="flex items-center shrink-0">
              <div className="flex flex-col items-center text-center">
                <div className="size-11 rounded-xl flex items-center justify-center text-xl mb-1.5" style={{ background: "#21262d" }}>{step.icon}</div>
                <div className="text-xs font-semibold text-white">{step.label}</div>
                <div className="text-[10px] text-slate-500">{step.sub}</div>
              </div>
              {i < 5 && (
                <div className="flex items-center mx-2">
                  <div className="w-8 h-px" style={{ background: "linear-gradient(to right, #25d366, #25d36660)" }} />
                  <div className="text-emerald-500 text-xs">›</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {/* Background Agent Invoice Folder Config */}
        <div className="rounded-xl border border-[#30363d] p-5 space-y-4" style={{ background: "#161b22" }}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Icons.agent />
              <span className="text-sm font-semibold text-white">Background Agent · Invoice Folder Target</span>
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-400 font-medium">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              Active Target
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Target Invoice Folder Path</label>
            <div className="flex gap-2">
              <input value={folder} onChange={e => setFolder(e.target.value)} placeholder="e.g. D:\Vyapar\Invoices" className="flex-1 px-3.5 py-2.5 rounded-lg text-sm text-white outline-none border border-[#30363d] focus:border-[#25d366] transition-colors font-mono" style={{ background: "#0d1117" }} />
              <button type="button" onClick={() => { setBrowserCurrentPath(folder); setShowFolderBrowser(true); }} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-slate-200 border border-[#30363d] hover:border-[#25d366] hover:text-[#25d366] transition-colors" style={{ background: "#21262d" }}>
                <Icons.folder />
                Browse Folder
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">Windows folder path where Vyapar saves downloaded PDFs or invoices.</p>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1.5">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {presetFolders.map(p => (
                <button key={p} type="button" onClick={() => setFolder(p)} className={`px-2.5 py-1 rounded text-xs font-mono transition-colors border ${folder === p ? "border-[#25d366] bg-[#25d366]/10 text-emerald-400 font-bold" : "border-[#30363d] text-slate-400 hover:text-white hover:border-slate-500"}`} style={{ background: "#0d1117" }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Watcher Options */}
          <div className="pt-2 border-t border-[#30363d] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Watch Polling Interval</label>
              <select value={watchInterval} onChange={e => setWatchInterval(e.target.value)} className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none border border-[#30363d] focus:border-[#25d366]" style={{ background: "#0d1117" }}>
                <option value="3">Every 3 seconds (Fast)</option>
                <option value="5">Every 5 seconds (Recommended)</option>
                <option value="10">Every 10 seconds</option>
                <option value="30">Every 30 seconds</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">Include Subfolders</label>
              <button type="button" onClick={() => setIncludeSubfolders(!includeSubfolders)} className="w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-300 border border-[#30363d] flex items-center justify-between" style={{ background: "#0d1117" }}>
                <span>Scan subdirectories</span>
                <span className={`text-xs font-bold ${includeSubfolders ? "text-emerald-400" : "text-slate-500"}`}>{includeSubfolders ? "ENABLED" : "DISABLED"}</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">Target File Types</label>
            <div className="flex items-center gap-4 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" checked={fileTypes.pdf} onChange={e => setFileTypes({ ...fileTypes, pdf: e.target.checked })} className="rounded accent-[#25d366]" />
                .PDF Invoices
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" checked={fileTypes.xlsx} onChange={e => setFileTypes({ ...fileTypes, xlsx: e.target.checked })} className="rounded accent-[#25d366]" />
                .XLSX Excel Exports
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" checked={fileTypes.csv} onChange={e => setFileTypes({ ...fileTypes, csv: e.target.checked })} className="rounded accent-[#25d366]" />
                .CSV Files
              </label>
            </div>
          </div>

          {/* Test Access & Status */}
          <div className="pt-2 border-t border-[#30363d] space-y-3">
            <div className="flex items-center justify-between">
              <button type="button" onClick={handleTestFolderAccess} disabled={testingAccess} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-200 border border-[#30363d] hover:border-emerald-500 hover:text-emerald-400 transition-colors" style={{ background: "#21262d" }}>
                <Icons.retry />
                {testingAccess ? "Scanning folder path…" : "Test Folder Access & Verify Target"}
              </button>
              <span className="text-xs text-slate-500 font-mono">Agent PID: 4821</span>
            </div>

            {testResult && (
              <div className="rounded-lg border border-emerald-500/30 p-3 space-y-1 text-xs" style={{ background: "#0d2b1a" }}>
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <Icons.check />
                  {testResult.message}
                </div>
                <div className="text-slate-300 font-mono">
                  Path: <span className="text-white">{folder}</span> · Detected <span className="text-emerald-400 font-bold">{testResult.filesFound} files</span> ready for extraction.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Folder Selector Dialog Modal */}
        {showFolderBrowser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-lg rounded-xl border border-[#30363d] p-6 space-y-4 shadow-2xl" style={{ background: "#161b22" }}>
              <div className="flex items-center justify-between border-b border-[#30363d] pb-3">
                <div className="flex items-center gap-2 text-white font-bold text-base">
                  <Icons.folder />
                  Select Agent Target Invoice Folder
                </div>
                <button onClick={() => setShowFolderBrowser(false)} className="text-slate-400 hover:text-white">
                  <Icons.close />
                </button>
              </div>

              <div className="space-y-3">
                <div className="text-xs text-slate-400 font-mono p-2 rounded bg-[#0d1117] border border-[#30363d] truncate">
                  Current Selection: <span className="text-emerald-400 font-semibold">{browserCurrentPath}</span>
                </div>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Directory Navigation</div>

                <div className="rounded-lg border border-[#30363d] p-2 space-y-1 max-h-56 overflow-y-auto" style={{ background: "#0d1117" }}>
                  {[
                    "D:\\Vyapar\\Invoices",
                    "D:\\Vyapar\\Backup",
                    "C:\\Users\\Public\\Documents\\Vyapar\\Invoices",
                    "C:\\Users\\Store\\Downloads\\Vyapar_Invoices",
                    "C:\\Users\\Store\\Documents\\Invoices",
                    "D:\\Billing\\Automated_Invoices",
                    "D:\\Downloads\\Invoices_2026"
                  ].map(dir => (
                    <button key={dir} type="button" onClick={() => setBrowserCurrentPath(dir)} className={`w-full text-left px-3 py-2 rounded text-xs font-mono flex items-center justify-between transition-colors ${browserCurrentPath === dir ? "bg-[#25d366]/15 text-emerald-400 border border-[#25d366]/40 font-bold" : "text-slate-300 hover:bg-[#21262d]"}`}>
                      <span className="flex items-center gap-2">
                        <Icons.folder />
                        {dir}
                      </span>
                      {browserCurrentPath === dir && <Icons.check />}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#30363d]">
                <button type="button" onClick={() => setShowFolderBrowser(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 border border-[#30363d] hover:border-slate-500">
                  Cancel
                </button>
                <button type="button" onClick={() => { setFolder(browserCurrentPath); setShowFolderBrowser(false); }} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#0d1117]" style={{ background: "#25d366" }}>
                  Select This Folder
                </button>
              </div>
            </div>
          </div>
        )}

        <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-[#0d1117] transition-all" style={{ background: saved ? "#128c7e" : "#25d366" }}>
          {saved ? "✓ Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

function Shell() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="flex min-h-screen" style={{ background: "#0d1117" }}>
      <Sidebar page={page} setPage={setPage} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {page === "dashboard" && <DashboardPage setPage={setPage} />}
        {page === "invoices" && <InvoicesPage />}
        {page === "customers" && <CustomersPage />}
        {page === "campaigns" && <CampaignsPage />}
        {page === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return <Shell />;
}
