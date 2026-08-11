import { useState, useEffect } from "react";
import { Agent, fetchAgents, createAgent, updateAgent, deleteAgent } from "../api/client";

interface Props {
  onLogout: () => void;
}

export default function AdminPage({ onLogout }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState({ username: "", full_name: "", email: "", password: "1234" });
  const [error, setError] = useState("");

  useEffect(() => { loadAgents(); }, []);

  const loadAgents = () => {
    fetchAgents().then(setAgents).catch(console.error);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await createAgent(form);
      setShowForm(false);
      setForm({ username: "", full_name: "", email: "", password: "1234" });
      loadAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgent) return;
    setError("");
    try {
      await updateAgent(editAgent.id, { full_name: form.full_name, email: form.email, is_active: true });
      setEditAgent(null);
      setForm({ username: "", full_name: "", email: "", password: "1234" });
      loadAgents();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this agent?")) return;
    await deleteAgent(id);
    loadAgents();
  };

  const startEdit = (agent: Agent) => {
    setEditAgent(agent);
    setForm({ username: agent.username, full_name: agent.full_name, email: agent.email || "", password: "" });
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Admin Panel — Agent Management</h1>
        <button
          onClick={onLogout}
          className="px-4 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          Logout
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-700">Agents ({agents.length})</h2>
          <button
            onClick={() => { setShowForm(true); setEditAgent(null); setForm({ username: "", full_name: "", email: "", password: "1234" }); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Create Agent
          </button>
        </div>

        {/* Create/Edit Form */}
        {(showForm || editAgent) && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">{editAgent ? "Edit Agent" : "Create New Agent"}</h3>
            <form onSubmit={editAgent ? handleUpdate : handleCreate} className="grid grid-cols-2 gap-4">
              {!editAgent && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Username</label>
                  <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Full Name</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              {!editAgent && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
                  <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              )}
              <div className="col-span-2 flex gap-3">
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                  {editAgent ? "Update" : "Create"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditAgent(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">
                  Cancel
                </button>
              </div>
              {error && <div className="col-span-2 text-red-500 text-sm">{error}</div>}
            </form>
          </div>
        )}

        {/* Agent Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Username</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Full Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-700">{agent.id}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">{agent.username}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{agent.full_name}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{agent.email || "—"}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${agent.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {agent.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <button onClick={() => startEdit(agent)} className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Edit</button>
                    <button onClick={() => handleDelete(agent.id)} className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">Delete</button>
                  </td>
                </tr>
              ))}
              {agents.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No agents found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
