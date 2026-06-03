import { useState } from "react";
import { CustomerDetail } from "./api/client";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ListPage from "./components/ListPage";
import DetailView from "./components/DetailView";

export default function App() {
  const [currentPage, setCurrentPage] = useState<"list" | "detail">("list");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  const handleSelectCustomer = (customer: CustomerDetail) => {
    setSelectedCustomer(customer);
    setCurrentPage("detail");
  };

  const handleBackToList = () => {
    setCurrentPage("list");
    setSelectedCustomer(null);
  };

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Header />
      <div style={{ marginLeft: "90px" }} className="pt-16">
        {currentPage === "list" && (
          <ListPage onSelectCustomer={handleSelectCustomer} />
        )}
        {currentPage === "detail" && selectedCustomer && (
          <DetailView customer={selectedCustomer} onBack={handleBackToList} />
        )}
      </div>
    </div>
  );
}
