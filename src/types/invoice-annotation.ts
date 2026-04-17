export type LabelType =
  | "vendor_name"
  | "invoice_number"
  | "date"
  | "due_date"
  | "total_amount"
  | "tax"
  | "line_item_desc"
  | "line_item_amount"
  | "currency";

export interface LabelConfig {
  id: LabelType;
  name: string;
  color: string;
  required: boolean;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Annotation {
  id: string;
  label: LabelType;
  box: BoundingBox;
  value: string;
  confidence: "low" | "medium" | "high";
}

export type DocumentStatus = "not_started" | "in_progress" | "complete";

export interface InvoiceDocument {
  id: string;
  name: string;
  type: "invoice" | "receipt";
  status: DocumentStatus;
  annotations: Annotation[];
}

export const LABELS: LabelConfig[] = [
  { id: "vendor_name", name: "Vendor Name", color: "hsl(210, 90%, 55%)", required: true },
  { id: "invoice_number", name: "Invoice Number", color: "hsl(340, 75%, 55%)", required: true },
  { id: "date", name: "Date", color: "hsl(160, 60%, 42%)", required: true },
  { id: "due_date", name: "Due Date", color: "hsl(120, 50%, 40%)", required: false },
  { id: "total_amount", name: "Total Amount", color: "hsl(32, 95%, 50%)", required: true },
  { id: "tax", name: "Tax", color: "hsl(280, 60%, 55%)", required: false },
  { id: "line_item_desc", name: "Line Item Desc", color: "hsl(190, 70%, 45%)", required: false },
  { id: "line_item_amount", name: "Line Item Amount", color: "hsl(15, 80%, 50%)", required: false },
  { id: "currency", name: "Currency", color: "hsl(45, 85%, 50%)", required: false },
];

export function getLabelConfig(id: LabelType): LabelConfig {
  return LABELS.find((l) => l.id === id)!;
}
