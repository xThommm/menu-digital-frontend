import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Auth/AuthContext";

export default function UserRoute() {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#0b0a08" }}>
        <div className="loader" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Un admin no tiene nada que hacer en el dashboard del restaurante
  if (user?.role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}