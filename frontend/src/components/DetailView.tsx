import { useState } from "react";
import { CustomerDetail, SessionInfo, createSession, fetchPersonalities } from "../api/client";
import CallSimulator from "./CallSimulator";
import { useEffect } from "react";

interface Props {
  customer: CustomerDetail;
  onBack: () => void;
}

export default function DetailView({ customer, onBack }: Props) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [personalities, setPersonalities] = useState<string[]>([]);
  const [selectedPersonality, setSelectedPersonality] = useState("cooperative");
  const [startingCall, setStartingCall] = useState(false);

  useEffect(() => {
    fetchPersonalities().then((p) => setPersonalities(p.map((x) => x.id)));
  }, []);

  const handleStartCall = async () => {
    setStartingCall(true);
    try {
      const sess = await createSession({
        customer_id: customer.accountInfo.accountNumber,
        personality_id: selectedPersonality,
        company_name: "Acme Collections",
      });
      setSession(sess);
    } catch (e) {
      console.error(e);
    } finally {
      setStartingCall(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("fail") || s.includes("overdue")) return "bg-red-100 text-red-800 border-red-200";
    if (s.includes("pending") || s.includes("upcoming")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (s.includes("success") || s.includes("paid")) return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Back Button + Account Info */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to List
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-800">{customer.basicInfo.fullName}</div>
          <div className="text-xs text-gray-500">Acc: {customer.accountInfo.accountNumber}</div>
        </div>
      </div>

      {/* Account Info Cards - 3 Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Highlights */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Account Highlights</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <InfoRow label="Phone" value={String(customer.basicInfo.cPhone)} />
              <InfoRow label="Email" value={customer.basicInfo.email} />
              <InfoRow label="Address" value={customer.basicInfo.address} />
              <InfoRow label="Timezone" value={customer.basicInfo.timezone} />
            </tbody>
          </table>
        </div>

        {/* Account Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Account Info</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <InfoRow label="Account Number" value={customer.accountInfo.accountNumber} />
              <InfoRow label="Account Type" value={customer.accountInfo.accountType} />
              <InfoRow label="Days Past Due" value={String(customer.accountInfo.daysPastDue)} />
              <InfoRow label="Status" value={customer.accountInfo.status} />
            </tbody>
          </table>
        </div>

        {/* Loan Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Loan Details</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <InfoRow label="Total Loan Amount" value={formatCurrency(customer.accountInfo.loanDetails.totalLoanAmount)} />
              <InfoRow label="Principal" value={formatCurrency(customer.accountInfo.loanDetails.principalAmount)} />
              <InfoRow label="Total Interest" value={formatCurrency(customer.accountInfo.loanDetails.interestAmount)} />
              <InfoRow label="Monthly Payment" value={formatCurrency(customer.accountInfo.paymentPlan.monthlyInstallment)} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Simulator Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Call Simulator</h3>
            </div>
            {!session && (
              <div className="flex items-center gap-3">
                <select
                  value={selectedPersonality}
                  onChange={(e) => setSelectedPersonality(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {personalities.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <button
                  onClick={handleStartCall}
                  disabled={startingCall}
                  className="px-5 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Start Call
                </button>
              </div>
            )}
            {session && (
              <button
                onClick={() => setSession(null)}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm"
              >
                End Call
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          {session ? (
            <CallSimulator session={session} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="text-lg font-medium">Ready to simulate a call</p>
              <p className="text-sm mt-1">Select a personality and click "Start Call" to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* Payments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Payments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Pending Payments</h3>
          </div>
          {customer.pending_payments.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">No pending payments</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Due Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.pending_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{p.id}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Processed Payments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Processed Payments</h3>
          </div>
          {customer.processed_payments.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">No processed payments</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.processed_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{p.id}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.dueDate || "")}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.method}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Activity Notes
        </h2>
        {customer.notes.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No activity notes</div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {[...customer.notes]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((note, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${note.isPinned ? "border-blue-300 bg-blue-50" : "border-gray-200"} hover:shadow-md transition-shadow`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                        {note.type}
                      </span>
                      {note.subType && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-gray-50 text-gray-600 rounded-full">
                          {note.subType}
                        </span>
                      )}
                      {note.isPinned && (
                        <svg className="h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M5 5a2 2 0 012-2h6a2 2 0 012 2v2H5V5zM4 9h12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V9z" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{note.description}</p>
                  {note.createdBy?.firstName && (
                    <div className="text-xs text-gray-500 mt-2">
                      By: {note.createdBy.firstName} {note.createdBy.lastName || ""}
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-3 text-sm font-medium text-gray-600 text-left">{label}</td>
      <td className="px-6 py-3 text-sm text-gray-900 text-left">{value}</td>
    </tr>
  );
}
