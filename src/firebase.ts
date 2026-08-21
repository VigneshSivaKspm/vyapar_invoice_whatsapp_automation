import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

// Replace with your actual Firebase project config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const isConfigured = !!firebaseConfig.projectId;

const app = isConfigured ? initializeApp(firebaseConfig) : null;
const db = isConfigured ? getFirestore(app!) : null;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CustomerDoc {
  id: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  totalInvoices: number;
  totalSpend: number;
  lastInvoiceDate: string;
  createdAt: string;
  tags?: string[];
}

export interface InvoiceDoc {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  mobile: string;
  amount: number;
  invoiceDate: string;
  fileName?: string;
  status: "SENT" | "PENDING" | "FAILED" | "DUPLICATE";
  whatsappMessageId?: string;
  createdAt: string;
  sentAt?: string;
  error?: string;
}

// ─── Customer helpers ─────────────────────────────────────────────────────────

export async function upsertCustomer(mobile: string, data: Partial<CustomerDoc>) {
  if (!db) return;
  const ref = doc(db, "customers", mobile);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, {
      ...data,
      totalInvoices: (snap.data().totalInvoices || 0) + 1,
      totalSpend: (snap.data().totalSpend || 0) + (data.totalSpend || 0),
      lastInvoiceDate: data.lastInvoiceDate,
    });
  } else {
    await setDoc(ref, {
      id: mobile,
      totalInvoices: 1,
      createdAt: new Date().toISOString(),
      ...data,
    });
  }
}

export async function getAllCustomers(): Promise<CustomerDoc[]> {
  if (!db) return [];
  const q = query(collection(db, "customers"), orderBy("lastInvoiceDate", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as CustomerDoc);
}

export async function getCustomerInvoices(mobile: string): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const q = query(
    collection(db, "invoices"),
    where("mobile", "==", mobile),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as InvoiceDoc);
}

// ─── Invoice helpers ──────────────────────────────────────────────────────────

export async function saveInvoice(invoice: InvoiceDoc) {
  if (!db) return;
  await setDoc(doc(db, "invoices", invoice.invoiceNo), invoice);
  // Upsert customer record every time an invoice is saved
  await upsertCustomer(invoice.mobile, {
    name: invoice.customerName,
    mobile: invoice.mobile,
    totalSpend: invoice.amount,
    lastInvoiceDate: invoice.invoiceDate,
  });
}

export async function updateInvoiceStatus(
  invoiceNo: string,
  status: InvoiceDoc["status"],
  extra?: { whatsappMessageId?: string; sentAt?: string; error?: string }
) {
  if (!db) return;
  await updateDoc(doc(db, "invoices", invoiceNo), { status, ...extra });
}

export { isConfigured, db, serverTimestamp, Timestamp };
