const API_BASE = "";

export interface Customer {
  id: string;
  name: string;
}

export interface Personality {
  id: string;
}

export interface SessionInfo {
  session_id: string;
  customer_id: string;
  customer_name: string;
  personality_id: string;
  company_name: string;
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${API_BASE}/api/customers`);
  if (!res.ok) throw new Error("Failed to load customers");
  return res.json();
}

export async function fetchPersonalities(): Promise<Personality[]> {
  const res = await fetch(`${API_BASE}/api/personalities`);
  if (!res.ok) throw new Error("Failed to load personalities");
  return res.json();
}

export async function createSession(body: {
  customer_id: string;
  personality_id: string;
  company_name?: string;
}): Promise<SessionInfo> {
  const res = await fetch(`${API_BASE}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create session");
  }
  return res.json();
}
