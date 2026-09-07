import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import FullScreenLoader from "../components/Common/FullScreenLoader";

export default function SellerRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "seller" && user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}
