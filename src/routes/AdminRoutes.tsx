import { useAuth } from "../context/useAuth";
import { useSessionSync } from "../context/useSessionSync";
import FullScreenLoader from "../components/Common/FullScreenLoader";
import { Navigate, Outlet } from "react-router-dom";

export default function AdminRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();
  useSessionSync();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}