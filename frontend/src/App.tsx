import { useState } from "react";
import { CustomerDetail, COLLECTOR } from "./api/client";
import PerformancePage from "./components/PerformancePage";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ListPage from "./components/ListPage";
import DetailView from "./components/DetailView";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"list" | "detail" | "performance">("list");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  const handleSelectCustomer = (customer: CustomerDetail) => {
    setSelectedCustomer(customer);
    setCurrentPage("detail");
  };

  const handleBackToList = () => {
    setCurrentPage("list");
    setSelectedCustomer(null);
  };

  // Single hardcoded collector — no login, opens directly into the app.
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Header collectorName={COLLECTOR.full_name} />
      <div style={{ marginLeft: "90px" }} className="pt-16">
        {currentPage === "list" && (
          <ListPage onSelectCustomer={handleSelectCustomer} onPerformance={() => setCurrentPage("performance")} />
        )}
        {currentPage === "detail" && selectedCustomer && (
          <DetailView customer={selectedCustomer} onBack={handleBackToList} />
        )}
        {currentPage === "performance" && (
          <PerformancePage onBack={() => setCurrentPage("list")} />
        )}
      </div>
    </div>
  );
}
