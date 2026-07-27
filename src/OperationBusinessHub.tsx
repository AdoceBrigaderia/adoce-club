import { useEffect, useState } from "react";
import OperationBusinessStructureBff from "./OperationBusinessStructureBff";
import OperationCashReconciliation from "./OperationCashReconciliation";
import OperationContingencySale from "./OperationContingencySale";
import OperationCustomer360 from "./OperationCustomer360";
import OperationCustomerCheckIns from "./OperationCustomerCheckIns";
import OperationManualSale from "./OperationManualSale";
import OperationPrivacyRequests from "./OperationPrivacyRequests";
import OperationQuickCash from "./OperationQuickCash";
import OperationQuickLoyalty from "./OperationQuickLoyalty";
import OperationReports from "./OperationReports";
import OperationWhatsAppHealth from "./OperationWhatsAppHealth";
import { getBffSession, type BffSession } from "./services/bff-auth";

export default function OperationBusinessHub() {
  const [session, setSession] = useState<BffSession | null>(null);
  const [error, setError] = useState("");
  const [businessRevision, setBusinessRevision] = useState(0);

  useEffect(() => {
    let active = true;
    void getBffSession()
      .then((next) => {
        if (!active) return;
        if (!next || next.user.surface !== "operation") {
          setError("Sua sessão operacional expirou. Entre novamente.");
          return;
        }
        setSession(next);
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível abrir a estrutura da operação.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p className="operation-dashboard-notice" role="status">
        {error}
      </p>
    );
  }
  if (!session) {
    return (
      <p className="operation-dashboard-notice">
        Carregando operação rápida…
      </p>
    );
  }

  const refreshBusinessViews = () =>
    setBusinessRevision((current) => current + 1);

  return (
    <>
      <OperationCustomerCheckIns />
      <OperationManualSale onCreated={refreshBusinessViews} />
      <OperationQuickLoyalty />
      <OperationPrivacyRequests />
      <OperationCustomer360 key={`customer-${businessRevision}`} />
      <OperationContingencySale />
      <OperationCashReconciliation />
      <OperationQuickCash key={`cash-${businessRevision}`} />
      <OperationWhatsAppHealth />
      <OperationReports key={`reports-${businessRevision}`} />
      <OperationBusinessStructureBff userId={session.user.id} />
    </>
  );
}
