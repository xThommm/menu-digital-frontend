import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import FullScreenLoader from "../components/Common/FullScreenLoader";

export default function UserRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.emailVerified === false) return <Navigate to="/verificar-email" replace />;

  return <Outlet />;
}