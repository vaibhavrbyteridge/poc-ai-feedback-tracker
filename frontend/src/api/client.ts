const API_BASE = "";

// ─── Single hardcoded collector ──────────────────────────────────────────
// This POC has exactly ONE collector. There is no login or user selection.
// COLLECTOR.id matches the demo collector row seeded in the database, so all
// call history, scoring, and performance data is scoped to this collector.
export interface Collector {
  id: number;
  full_name: string;
}

export const COLLECTOR: Collector = {
  id: 5,
  full_name: "Demo Collector",
};

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
    language: string;
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
  phone_numbers?: Array<{
    phone: string;
    contact_name: string;
    email: string;
    type: string;
    status: string;
    timezone: string;
    do_not_call: boolean;
    do_not_text: boolean;
    do_not_email: boolean;
    is_main: boolean;
  }>;
  bankruptcyCases?: Array<{
    caseNumber: string;
    chapter: string;
    petitionDate: string;
    status: string;
    dischargeDate: string;
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
}> {
  const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/opening-suggestions`);
  if (!res.ok) throw new Error("Failed to load opening suggestions");
  return res.json();
}


// ─── Call History ────────────────────────────────────────────────────────

export interface CallHistoryItem {
  id: number;
  session_id: string;
  customer_id: string;
  customer_name: string;
  personality_id: string;
  company_name: string;
  turn_count: number;
  ai_score: number | null;
  created_at: string;
  dialed_phone?: string;
}

export async function fetchCallHistory(userId: number): Promise<CallHistoryItem[]> {
  const res = await fetch(`${API_BASE}/api/call-history/${userId}`);
  if (!res.ok) throw new Error("Failed to load call history");
  return res.json();
}

export async function saveCallHistory(body: {
  session_id: string;
  user_id?: number;
  customer_id: string;
  customer_name: string;
  personality_id: string;
  company_name?: string;
  dialed_phone?: string;
  turns: { collector: string; customer: string; suggestions?: unknown[] }[];
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/call-history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: COLLECTOR.id, ...body }),
  });
  if (!res.ok) throw new Error("Failed to save call");
}

export interface CallTurn {
  turn_number: number;
  collector: string;
  customer: string;
  suggestions: { text: string; tone: string }[];
}

export async function fetchCallTurns(userId: number, sessionId: string): Promise<CallTurn[]> {
  const res = await fetch(`${API_BASE}/api/call-history/${userId}/${sessionId}/turns`);
  if (!res.ok) throw new Error("Failed to load call turns");
  return res.json();
}

export async function deleteCallHistory(userId: number, sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/call-history/${userId}/${sessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete call");
}


// ─── Call Scoring ────────────────────────────────────────────────────────

export interface ScoreResult {
  compliance: { score: number; max: number };
  communication: { score: number; max: number };
  empathy: { score: number; max: number };
  negotiation: { score: number; max: number };
  objection_handling: { score: number; max: number };
  closure: { score: number; max: number };
  overall_score: number;
  what_went_well: string[];
  areas_of_improvement: string[];
  ideal_responses: { turn: number; collector_said: string; ideal_response: string }[];
}

export async function scoreCall(body: {
  session_id: string;
  user_id: number;
  turns: { collector: string; customer: string }[];
  dialed_phone?: string;
}): Promise<ScoreResult> {
  const res = await fetch(`${API_BASE}/api/score-call`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Scoring failed");
  }
  return res.json();
}


export async function fetchCallScore(sessionId: string): Promise<(ScoreResult & { scored: true }) | { scored: false }> {
  const res = await fetch(`${API_BASE}/api/call-score/${sessionId}`);
  if (!res.ok) return { scored: false };
  return res.json();
}


export async function deleteCallScore(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/call-score/${sessionId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete score");
}


// ─── Agent Performance ──────────────────────────────────────────────────

export interface AgentPerformance {
  total_calls_scored: number;
  overall_score: number;
  compliance: { score: number; max: number };
  communication: { score: number; max: number };
  empathy: { score: number; max: number };
  negotiation: { score: number; max: number };
  objection_handling: { score: number; max: number };
  closure: { score: number; max: number };
}

export async function fetchAgentPerformance(userId: number): Promise<AgentPerformance> {
  const res = await fetch(`${API_BASE}/api/agent-performance/${userId}`);
  if (!res.ok) throw new Error("Failed to load performance");
  return res.json();
}


// ─── Feedback Goals ─────────────────────────────────────────────────────

export interface FeedbackGoal {
  id: number;
  session_id: string | null;
  feedback_text: string;
  status: "open" | "in_progress" | "completed";
  target_date: string | null;
  accepted: boolean;
  rejected_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export async function fetchFeedbacks(userId: number): Promise<FeedbackGoal[]> {
  const res = await fetch(`${API_BASE}/api/feedbacks/${userId}`);
  if (!res.ok) throw new Error("Failed to load feedbacks");
  return res.json();
}

export async function createFeedback(body: { user_id: number; session_id?: string; feedback_text: string; target_days?: number }): Promise<FeedbackGoal> {
  const res = await fetch(`${API_BASE}/api/feedbacks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create feedback");
  return res.json();
}

export async function updateFeedbackStatus(feedbackId: number, status: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/feedbacks/${feedbackId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update feedback");
}

export async function rejectFeedback(feedbackId: number, reason: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/feedbacks/${feedbackId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Failed to reject feedback");
}


// ─── Weekly Performance + AI Feedback ───────────────────────────────────

export interface WeeklyData {
  session_id: string;
  customer_name: string;
  score: number;
  date: string;
}

export async function fetchWeeklyPerformance(userId: number): Promise<WeeklyData[]> {
  const res = await fetch(`${API_BASE}/api/weekly-performance/${userId}`);
  if (!res.ok) throw new Error("Failed to load weekly data");
  return res.json();
}

export async function fetchAiFeedback(userId: number): Promise<{ feedback: string | null; updated_at: string | null }> {
  const res = await fetch(`${API_BASE}/api/ai-feedback/${userId}`);
  if (!res.ok) throw new Error("Failed to load AI feedback");
  return res.json();
}

export async function generateAiFeedback(userId: number): Promise<{ feedback: string }> {
  const res = await fetch(`${API_BASE}/api/ai-feedback/${userId}/generate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate feedback");
  return res.json();
}


// ─── Phone Numbers Update ───────────────────────────────────────────────

export async function updatePhoneNumbers(customerId: string, phoneNumbers: Array<{
  phone: string;
  contact_name: string;
  email: string;
  type: string;
  status: string;
  timezone: string;
  do_not_call: boolean;
  do_not_text: boolean;
  do_not_email: boolean;
}>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/customers/${customerId}/phone-numbers`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(phoneNumbers),
  });
  if (!res.ok) throw new Error("Failed to update phone numbers");
}


// ─── Bankruptcy Cases ───────────────────────────────────────────────────

export interface BankruptcyCase {
  caseNumber: string;
  chapter: string;
  petitionDate: string;
  status: string;
  dischargeDate: string;
}

export async function updateBankruptcyCases(customerId: string, cases: BankruptcyCase[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/customers/${customerId}/bankruptcy-cases`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cases),
  });
  if (!res.ok) throw new Error("Failed to update bankruptcy cases");
}


// ─── Call Disposition ────────────────────────────────────────────────────

export async function saveDisposition(sessionId: string, body: { disposition: string; call_type: string; notes: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/call-disposition/${sessionId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save disposition");
}

export async function fetchDisposition(sessionId: string): Promise<{ disposition: string | null; call_type: string; notes: string }> {
  const res = await fetch(`${API_BASE}/api/call-disposition/${sessionId}`);
  if (!res.ok) throw new Error("Failed to load disposition");
  return res.json();
}


// ─── Customer Info Update ───────────────────────────────────────────────

export async function updateCustomerInfo(customerId: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/customers/${customerId}/info`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update customer info");
}


// ─── Action Items ────────────────────────────────────────────────────────

export interface ActionItem {
  id: number;
  action_text: string;
  field_category: string;
  field_name: string;
  field_value: string;
  status: "pending" | "completed";
  created_at?: string;
  completed_at?: string | null;
  session_id?: string;
}

export async function fetchActionItems(sessionId: string): Promise<ActionItem[]> {
  const res = await fetch(`${API_BASE}/api/action-items/${sessionId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCustomerActionItems(userId: number, customerId: string): Promise<ActionItem[]> {
  const res = await fetch(`${API_BASE}/api/action-items/customer/${userId}/${customerId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function completeActionItem(itemId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/action-items/${itemId}/complete`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to complete action item");
}


// ─── Edit Flags + Contact Preferences ───────────────────────────────────

export interface EditFlags {
  session_id: string;
  dialed_phone: string;
  flag_phone: boolean;
  flag_email: boolean;
  flag_address: boolean;
  flag_timezone: boolean;
  flag_language_preference: boolean;
  flag_account_type: boolean;
  flag_days_past_due: boolean;
  flag_status: boolean;
  flag_total_loan_amount: boolean;
  flag_principal: boolean;
  flag_interest: boolean;
  flag_monthly_payment: boolean;
  flag_do_not_call: boolean;
  flag_do_not_text: boolean;
  flag_do_not_email: boolean;
  flag_disposition: boolean;
  flag_call_type: boolean;
  flag_cease_all_contact: boolean;
  suggested_values: Record<string, string> | null;
  flag_reasons: Record<string, string> | null;
}

export async function fetchEditFlags(userId: number, customerId: string): Promise<EditFlags[]> {
  const res = await fetch(`${API_BASE}/api/edit-flags/${userId}/${customerId}`);
  if (!res.ok) return [];
  return res.json();
}

export async function clearEditFlag(sessionId: string, flagName: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/edit-flags/${sessionId}/clear/${flagName}`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to clear flag");
}

export interface ContactPreferences {
  cease_all_calls: boolean;
  cease_all_texts: boolean;
  cease_all_emails: boolean;
  cease_all_contact: boolean;
}

export async function fetchContactPreferences(customerId: string): Promise<ContactPreferences> {
  const res = await fetch(`${API_BASE}/api/contact-preferences/${customerId}`);
  if (!res.ok) return { cease_all_calls: false, cease_all_texts: false, cease_all_emails: false, cease_all_contact: false };
  return res.json();
}

export async function saveContactPreferences(customerId: string, body: { user_id: number; session_id?: string; cease_all_calls: boolean; cease_all_texts: boolean; cease_all_emails: boolean; cease_all_contact: boolean; reason: string }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/contact-preferences/${customerId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save preferences");
}


// ─── Accept All Action Items ────────────────────────────────────────────

export async function acceptAllActionItems(body: { session_id: string; user_id: number; customer_id: string }): Promise<{ applied: number }> {
  const res = await fetch(`${API_BASE}/api/action-items/accept-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to accept all");
  return res.json();
}
