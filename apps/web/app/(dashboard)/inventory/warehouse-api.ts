import type { WarehouseDocument, WarehouseDocumentDetails, WarehouseDocumentInput, WarehouseListFilters, WarehouseProduct, WarehouseSummary, WarehouseSupplier } from "./warehouse-types";

export function mapWarehouseLineErrors(body: unknown, lines: Array<{ key: string }>) {
  const result: Record<string, Record<string, string>> = {};
  const errors = body && typeof body === "object" && "line_errors" in body && Array.isArray(body.line_errors) ? body.line_errors : [];
  for (const item of errors) {
    if (!item || typeof item !== "object") continue;
    const value = item as { line?: number; field?: string; message?: string };
    const key = typeof value.line === "number" ? lines[value.line - 1]?.key : undefined;
    if (!key || !value.field || !value.message) continue;
    result[key] = { ...result[key], [value.field]: value.message };
  }
  return result;
}

export class WarehouseApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) { super(`Warehouse request failed (${status})`); this.name = "WarehouseApiError"; }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`, { credentials: "include", ...init });
  if (!response.ok) throw new WarehouseApiError(response.status, await response.json().catch(() => ({})));
  return response.json() as Promise<T>;
}

function query(filters: WarehouseListFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  const suffix = params.toString();
  return suffix ? `?${suffix}` : "";
}
function base(salonId: string) { return `/api/salons/${encodeURIComponent(salonId)}/inventory`; }

export const warehouseApi = {
  getSummary: (salonId: string) => request<WarehouseSummary>(`${base(salonId)}/summary`),
  getProducts: (salonId: string, filters: WarehouseListFilters = {}) => request<WarehouseProduct[]>(`${base(salonId)}/products${query(filters)}`),
  getSuppliers: (salonId: string, filters: WarehouseListFilters = {}) => request<WarehouseSupplier[]>(`${base(salonId)}/suppliers${query(filters)}`),
  getDocuments: (salonId: string, filters: WarehouseListFilters = {}) => request<WarehouseDocument[]>(`${base(salonId)}/documents${query(filters)}`),
  getDocument: (salonId: string, documentId: string) => request<WarehouseDocumentDetails>(`${base(salonId)}/documents/${encodeURIComponent(documentId)}`),
  saveDocument: (salonId: string, input: WarehouseDocumentInput, documentId?: string) => request<WarehouseDocument>(`${base(salonId)}/documents${documentId ? `/${encodeURIComponent(documentId)}` : ""}`, { method: documentId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }),
  postDocument: (salonId: string, documentId: string) => request<{ documentId: string; status: "posted" }>(`${base(salonId)}/documents/${encodeURIComponent(documentId)}/post`, { method: "POST" }),
  reverseDocument: (salonId: string, documentId: string) => request<{ documentId: string; status: "posted" }>(`${base(salonId)}/documents/${encodeURIComponent(documentId)}/reverse`, { method: "POST" }),
  createSupplier: (salonId: string, input: Partial<WarehouseSupplier> & { name: string }) => request<WarehouseSupplier>(`${base(salonId)}/suppliers`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(toSupplierInput(input)) }),
  updateSupplier: (salonId: string, supplierId: string, input: Partial<WarehouseSupplier> & { name?: string }) => request<WarehouseSupplier>(`${base(salonId)}/suppliers/${encodeURIComponent(supplierId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(toSupplierInput(input)) }),
};

function toSupplierInput(input: Partial<WarehouseSupplier> & { name?: string }) {
  return { name: input.name, contact_name: input.contactName, vat_number: input.vatNumber, tax_code: input.taxCode, email: input.email, phone: input.phone, address: input.address, city: input.city, postal_code: input.postalCode, country: input.country, payment_terms: input.paymentTerms, notes: input.notes };
}
