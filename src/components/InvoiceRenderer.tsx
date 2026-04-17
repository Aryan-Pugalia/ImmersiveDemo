import { MockInvoiceData } from "@/data/invoice-mock-documents";

interface InvoiceRendererProps {
  data: MockInvoiceData;
  width?: number;
  height?: number;
}

export function InvoiceRenderer({ data, width = 540, height = 440 }: InvoiceRendererProps) {
  const subtotal = data.items.reduce((s, i) => s + i.qty * i.price, 0);

  return (
    <div
      className="bg-white border border-border rounded-md overflow-hidden select-none pointer-events-none"
      style={{ width, height, fontFamily: "'Courier New', monospace", fontSize: 13, padding: 28, position: "relative", color: "#1a1a2e" }}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="font-bold text-lg" style={{ color: "hsl(230,65%,52%)" }}>{data.vendor}</div>
          <div className="text-xs mt-1" style={{ color: "#666" }}>{data.address}</div>
        </div>
        <div className="text-right text-xs" style={{ color: "#333" }}>
          <div className="font-bold">Invoice #{data.invoiceNumber}</div>
          <div className="mt-1">Date: {data.date}</div>
          <div>Due: {data.dueDate}</div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #ddd", margin: "12px 0" }} />

      {/* Line items header */}
      <div className="grid grid-cols-[1fr_50px_80px_80px] text-xs font-bold mb-2" style={{ color: "#555" }}>
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
      </div>

      {/* Line items */}
      {data.items.map((item, i) => (
        <div key={i} className="grid grid-cols-[1fr_50px_80px_80px] text-xs py-1" style={{ borderBottom: "1px solid #eee", color: "#333" }}>
          <span>{item.description}</span>
          <span className="text-right">{item.qty}</span>
          <span className="text-right">${item.price.toFixed(2)}</span>
          <span className="text-right">${(item.qty * item.price).toFixed(2)}</span>
        </div>
      ))}

      {/* Totals */}
      <div className="mt-4 flex flex-col items-end text-xs space-y-1">
        <div className="flex gap-8" style={{ color: "#555" }}><span>Subtotal:</span> <span className="font-medium" style={{ color: "#333" }}>${subtotal.toFixed(2)}</span></div>
        <div className="flex gap-8" style={{ color: "#555" }}><span>Tax:</span> <span className="font-medium" style={{ color: "#333" }}>${data.tax.toFixed(2)}</span></div>
        <div className="flex gap-8 text-sm font-bold mt-1 pt-1" style={{ borderTop: "1px solid #ccc", color: "#111" }}><span>Total:</span> <span>${data.total.toFixed(2)}</span></div>
      </div>
    </div>
  );
}
