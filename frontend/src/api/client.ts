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

export interface CustomerDetail {
  accountInfo: {
    accountHolder: string;
    accountId: string;
    accountNumber: string;
    accountType: string;
    daysPastDue: number;
    defaultReason?: string;
    status: string;
    loanDetails: {
      totalLoanAmount: number;
      principalAmount: number;
      interestAmount: number;
      totalPending: number;
      totalPaid: number;
      interestRate: number;
      lateFeesAccrued: number;
      loanTerm: number;
      [key: string]: unknown;
    };
    paymentPlan: {
      monthlyInstallment: number;
      frequency: string;
      status: string;
      installmentsPaid: number;
      installmentsRemaining: number;
      nextPaymentDate: string;
      [key: string]: unknown;
    };
  };
  basicInfo: {
    fullName: string;
    cPhone: string | number;
    email: string;
    address: string;
    dob: string;
    timezone: string;
    [key: string]: unknown;
  };
  notes: Array<{
    createdAt: string;
    type: string;
    subType?: string;
    description: string;
    isPinned: boolean;
    createdBy?: { firstName?: string; lastName?: string; email?: string };
    [key: string]: unknown;
  }>;
  pending_payments: Array<{
    id: string;
    amount: number;
    dueDate: string;
    status: string;
    daysPastDue: number;
    [key: string]: unknown;
  }>;
  processed_payments: Array<{
    id: string;
    amount: number;
    dueDate?: string;
    date?: string;
    method: string;
    status: string;
    failureReason?: string;
    [key: string]: unknown;
  }>;
}

export async function fetchCustomerDetails(): Promise<CustomerDetail[]> {
  const res = await fetch(`${API_BASE}/api/customers/details`);
  if (!res.ok) throw new Error("Failed to load customer details");
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

export interface ConversationTurn {
  turn_number: number;
  timestamp: string;
  collector_transcript: string;
  customer_text: string;
  suggestions: { text: string; tone: string }[];
}

export interface ConversationLog {
  session_id: string;
  customer_name: string;
  personality_id: string;
  company_name: string;
  created_at: string;
  turn_count: number;
  turns: ConversationTurn[];
}

export async function fetchCustomerConversations(
  customerId: string
): Promise<ConversationLog[]> {
  const res = await fetch(`${API_BASE}/api/customers/${customerId}/conversations`);
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

export async function fetchOpeningSuggestions(
  sessionId: string
): Promise<{
  suggestions: { text: string; tone: string }[];
  classification: string;
  confidence: number;
  reasoning: string;
  current_phase?: string;
  phases_completed?: string[];
  next_step?: string;
  alerts?: string[];
  compliance_disclosed?: boolean;
  identity_verified?: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/opening-suggestions`);
  if (!res.ok) throw new Error("Failed to load opening suggestions");
  return res.json();
}

export async function overrideClassification(
  sessionId: string,
  turnNumber: number,
  classification: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/override-classification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turn_number: turnNumber, classification }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to override classification");
  }
}
