import json
from datetime import datetime

from app.config import get_settings
from app.paths import data_dir
from app.rag.protocols import Chunk

_settings = get_settings()
DATA_PATH = data_dir() / ("debt_data_sample_dummy.json" if _settings.use_dummy_data else "debt_data_sample.json")


class MockRetriever:
    def __init__(self) -> None:
        with open(DATA_PATH, encoding="utf-8") as f:
            customers_list = json.load(f)
        self._customers = {
            c["accountInfo"]["accountNumber"]: c
            for c in customers_list
        }

    async def retrieve(
        self, customer_id: str, query: str, top_k: int = 5
    ) -> list[Chunk]:
        customer = self._customers.get(customer_id)
        if not customer:
            return [Chunk(text=f"No records found for customer {customer_id}.")]

        basic = customer.get("basicInfo", {})
        account = customer.get("accountInfo", {})
        loan = account.get("loanDetails", {})
        plan = account.get("paymentPlan", {})
        notes = customer.get("notes", [])
        pending = customer.get("pending_payments", [])
        processed = customer.get("processed_payments", [])

        # Build a concise but informative context string
        lines = [
            f"Customer: {basic.get('fullName', 'Unknown')}",
            f"Account: {account.get('accountNumber', 'N/A')} ({account.get('accountType', 'N/A')})",
            f"Status: {account.get('status', 'Unknown')} — {account.get('daysPastDue', 0)} days past due",
            f"Default reason: {account.get('defaultReason', 'N/A')}",
            f"Total pending: ${loan.get('totalPending', 0):,.2f}",
            f"Principal pending: ${loan.get('principalPending', 0):,.2f}",
            f"Interest pending: ${loan.get('interestPending', 0):,.2f}",
            f"Late fees accrued: ${loan.get('lateFeesAccrued', 0):,.2f}",
            f"Monthly installment: ${plan.get('monthlyInstallment', 0):,.2f}",
            f"Payment plan status: {plan.get('status', 'N/A')}",
            f"Next payment date: {plan.get('nextPaymentDate', 'N/A')}",
        ]

        # Add recent notes (most recent first, top 5)
        if notes:
            sorted_notes = sorted(
                notes,
                key=lambda n: n.get("createdAt", ""),
                reverse=True,
            )[:5]
            lines.append("\nRecent interaction notes:")
            for note in sorted_notes:
                date_str = note.get("createdAt", "")[:10]
                desc = note.get("description", "")
                note_type = note.get("type", "")
                lines.append(f"  [{date_str}] ({note_type}) {desc}")

        # Add pending payments summary
        if pending:
            overdue = [p for p in pending if p.get("status") == "Overdue"]
            if overdue:
                lines.append(f"\nOverdue payments: {len(overdue)}")
                for p in overdue:
                    lines.append(
                        f"  ${p['amount']:,.2f} due {p['dueDate']} "
                        f"({p.get('daysPastDue', 0)} days late)"
                    )

        # Add recent payment history (failures)
        failed = [p for p in processed if p.get("status") == "Failed"]
        if failed:
            lines.append(f"\nFailed payments: {len(failed)} recent")
            for p in failed[-3:]:
                lines.append(
                    f"  ${p['amount']:,.2f} on {p['dueDate']} — {p.get('failureReason', 'Unknown')}"
                )

        text = "\n".join(lines)
        return [Chunk(text=text, source="debt_data_sample.json")]
