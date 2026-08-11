import { useEffect, useState, useMemo } from "react";
import { CustomerDetail, fetchCustomerDetails } from "../api/client";

interface Props {
  onSelectCustomer: (customer: CustomerDetail) => void;
  onPerformance?: () => void;
}

export default function ListPage({ onSelectCustomer, onPerformance }: Props) {
  const [customers, setCustomers] = useState<CustomerDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "accountInfo.daysPastDue",
    direction: "desc",
  });

  useEffect(() => {
    fetchCustomerDetails()
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sortedCustomers = useMemo(() => {
    const sorted = [...customers];
    sorted.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";

      switch (sortConfig.key) {
        case "accountInfo.daysPastDue":
          aVal = a.accountInfo.daysPastDue;
          bVal = b.accountInfo.daysPastDue;
          break;
        case "accountInfo.status":
          aVal = a.accountInfo.status;
          bVal = b.accountInfo.status;
          break;
        case "accountInfo.accountNumber":
          aVal = a.accountInfo.accountNumber;
          bVal = b.accountInfo.accountNumber;
          break;
        default:
          aVal = a.basicInfo.fullName;
          bVal = b.basicInfo.fullName;
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [customers, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return "";
    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("default")) return "bg-red-100 text-red-800";
    if (s.includes("delinquent")) return "bg-yellow-100 text-yellow-800";
    if (s.includes("current") || s.includes("good")) return "bg-green-100 text-green-800";
    return "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading accounts...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-red-800">
        <p className="font-medium">Failed to load accounts</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Debtor Accounts</h2>
        {onPerformance && (
          <button
            onClick={onPerformance}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-purple-700 hover:to-blue-700 transition-all shadow-md flex items-center gap-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            My Performance
          </button>
        )}
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-white border-b-2 border-gray-200">
              <tr>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  <button onClick={() => handleSort("accountInfo.accountNumber")} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                    Account Number{getSortIndicator("accountInfo.accountNumber")}
                  </button>
                </th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">Account Holder</th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  <button onClick={() => handleSort("accountInfo.daysPastDue")} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                    Days Past Due{getSortIndicator("accountInfo.daysPastDue")}
                  </button>
                </th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">Total Pending</th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                  <button onClick={() => handleSort("accountInfo.status")} className="flex items-center gap-1 font-semibold text-gray-700 hover:text-blue-600 transition-colors">
                    Status{getSortIndicator("accountInfo.status")}
                  </button>
                </th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">Account Type</th>
                <th className="px-4 py-4 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedCustomers.map((customer) => (
                <tr key={customer.accountInfo.accountNumber} className="hover:bg-gray-50 transition-colors">
                  <td
                    className="px-4 py-4 font-semibold text-blue-600 hover:text-blue-800 cursor-pointer text-sm transition-colors"
                    onClick={() => onSelectCustomer(customer)}
                  >
                    {customer.accountInfo.accountNumber}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900 text-sm">{customer.basicInfo.fullName}</div>
                    <div className="text-xs text-gray-500">{customer.basicInfo.email}</div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 font-medium">
                    {customer.accountInfo.daysPastDue}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 font-semibold">
                    ${customer.accountInfo.loanDetails.totalPending.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(customer.accountInfo.status)}`}>
                      {customer.accountInfo.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700">{customer.accountInfo.accountType}</td>
                  <td className="px-4 py-4 text-sm text-gray-700">{String(customer.basicInfo.cPhone)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
