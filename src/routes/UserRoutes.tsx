import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useSessionSync } from "../context/useSessionSync";
import FullScreenLoader from "../components/Common/FullScreenLoader";
import OwnerAlertsProvider from "../features/ownerAlerts/OwnerAlertsProvider";

export default function UserRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();
  useSessionSync();

  if (isLoading) return <FullScreenLoader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  if (user?.role === "seller") {
    return <Navigate to="/sellers" replace />;
  }

  if (user?.role !== "user") {
    return <Navigate to="/login" replace />;
  }

  if (user?.emailVerified === false) {
    return <Navigate to="/verificar-email" replace />;
  }

  // Avisos (sonido + tarjeta + push) en todas las pantallas del panel del dueño.
  return (
    <OwnerAlertsProvider>
      <Outlet />
    </OwnerAlertsProvider>
  );
}