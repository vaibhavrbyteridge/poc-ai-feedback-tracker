import { FormEvent, useEffect, useState } from "react";
import {
  createSession,
  Customer,
  fetchCustomers,
  fetchPersonalities,
  Personality,
  SessionInfo,
} from "../api/client";

interface Props {
  onSession: (session: SessionInfo) => void;
}

export default function SessionSetup({ onSession }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [personalityId, setPersonalityId] = useState("");
  const [companyName, setCompanyName] = useState("Acme Collections");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchCustomers(), fetchPersonalities()])
      .then(([c, p]) => {
        setCustomers(c);
        setPersonalities(p);
        if (c.length) setCustomerId(c[0].id);
        if (p.length) setPersonalityId(p[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const session = await createSession({
        customer_id: customerId,
        personality_id: personalityId,
        company_name: companyName,
      });
      onSession(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start session");
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="card setup-form">
      <h2>Start session</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <label>
          Customer (debtor account)
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Customer personality (AI role)
          <select
            value={personalityId}
            onChange={(e) => setPersonalityId(e.target.value)}
          >
            {personalities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Company name
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
        </label>
        <button type="submit">Start call</button>
      </form>
    </div>
  );
}
