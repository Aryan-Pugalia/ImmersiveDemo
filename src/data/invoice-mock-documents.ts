import { InvoiceDocument } from "@/types/invoice-annotation";

export const mockDocuments: InvoiceDocument[] = [
  {
    id: "inv-001",
    name: "Acme Corp Invoice #1042",
    type: "invoice",
    status: "complete",
    annotations: [
      { id: "a1", label: "vendor_name", box: { x: 40, y: 30, width: 200, height: 32 }, value: "Acme Corporation", confidence: "high" },
      { id: "a2", label: "invoice_number", box: { x: 380, y: 30, width: 120, height: 24 }, value: "INV-1042", confidence: "high" },
      { id: "a3", label: "date", box: { x: 380, y: 60, width: 120, height: 24 }, value: "2026-03-15", confidence: "high" },
      { id: "a4", label: "total_amount", box: { x: 380, y: 340, width: 120, height: 28 }, value: "$2,450.00", confidence: "medium" },
      { id: "a5", label: "tax", box: { x: 380, y: 310, width: 120, height: 24 }, value: "$196.00", confidence: "medium" },
    ],
  },
  {
    id: "inv-002",
    name: "TechSupply Receipt #R-887",
    type: "receipt",
    status: "in_progress",
    annotations: [
      { id: "b1", label: "vendor_name", box: { x: 60, y: 20, width: 180, height: 30 }, value: "TechSupply Ltd", confidence: "high" },
    ],
  },
  {
    id: "inv-003",
    name: "Global Freight Invoice #GF-204",
    type: "invoice",
    status: "not_started",
    annotations: [],
  },
  {
    id: "inv-004",
    name: "CaféBrew Receipt #4401",
    type: "receipt",
    status: "not_started",
    annotations: [],
  },
];

export interface MockInvoiceData {
  vendor: string;
  address: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  items: { description: string; qty: number; price: number }[];
  tax: number;
  total: number;
}

export const mockInvoiceContent: Record<string, MockInvoiceData> = {
  "inv-001": {
    vendor: "Acme Corporation",
    address: "123 Industrial Blvd, Chicago, IL 60601",
    invoiceNumber: "INV-1042",
    date: "Mar 15, 2026",
    dueDate: "Apr 14, 2026",
    items: [
      { description: "Widget Assembly Kit", qty: 50, price: 25.0 },
      { description: "Precision Bearings", qty: 100, price: 8.5 },
      { description: "Hydraulic Pump Unit", qty: 2, price: 275.0 },
    ],
    tax: 196.0,
    total: 2450.0,
  },
  "inv-002": {
    vendor: "TechSupply Ltd",
    address: "456 Silicon Ave, San Jose, CA 95112",
    invoiceNumber: "R-887",
    date: "Mar 28, 2026",
    dueDate: "N/A",
    items: [
      { description: "USB-C Hub (7-port)", qty: 3, price: 49.99 },
      { description: "Wireless Mouse", qty: 5, price: 24.99 },
    ],
    tax: 22.49,
    total: 297.42,
  },
  "inv-003": {
    vendor: "Global Freight Co.",
    address: "789 Harbor Rd, Long Beach, CA 90802",
    invoiceNumber: "GF-204",
    date: "Apr 1, 2026",
    dueDate: "May 1, 2026",
    items: [
      { description: "Container Shipping (20ft)", qty: 1, price: 3200.0 },
      { description: "Customs Brokerage Fee", qty: 1, price: 450.0 },
      { description: "Insurance Premium", qty: 1, price: 180.0 },
    ],
    tax: 383.0,
    total: 4213.0,
  },
  "inv-004": {
    vendor: "CaféBrew",
    address: "12 Main Street, Portland, OR 97201",
    invoiceNumber: "#4401",
    date: "Apr 10, 2026",
    dueDate: "N/A",
    items: [
      { description: "Espresso x2", qty: 2, price: 4.5 },
      { description: "Croissant", qty: 1, price: 3.75 },
    ],
    tax: 1.15,
    total: 13.9,
  },
};
