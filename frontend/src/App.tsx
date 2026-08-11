import { useState } from "react";
import { CustomerDetail, User } from "./api/client";
import LoginPage from "./components/LoginPage";
import AdminPage from "./components/AdminPage";
import PerformancePage from "./components/PerformancePage";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import ListPage from "./components/ListPage";
import DetailView from "./components/DetailView";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [currentPage, setCurrentPage] = useState<"list" | "detail" | "performance">("list");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem("user", JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  const handleSelectCustomer = (customer: CustomerDetail) => {
    setSelectedCustomer(customer);
    setCurrentPage("detail");
  };

  const handleBackToList = () => {
    setCurrentPage("list");
    setSelectedCustomer(null);
  };

  // Not logged in
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Admin view
  if (user.role === "admin") {
    return <AdminPage onLogout={handleLogout} />;
  }

  // Agent view
  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Header user={user} onLogout={handleLogout} />
      <div style={{ marginLeft: "90px" }} className="pt-16">
        {currentPage === "list" && (
          <ListPage onSelectCustomer={handleSelectCustomer} onPerformance={() => setCurrentPage("performance")} />
        )}
        {currentPage === "detail" && selectedCustomer && (
          <DetailView customer={selectedCustomer} onBack={handleBackToList} user={user} />
        )}
        {currentPage === "performance" && (
          <PerformancePage userId={user.id} userName={user.full_name} onBack={() => setCurrentPage("list")} />
        )}
      </div>
    </div>
  );
}
