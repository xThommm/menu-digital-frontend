import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../context/useAuth";
import FullScreenLoader from "../components/Common/FullScreenLoader";
import s from "../components/Seller/sellerPanel.module.css";

export default function SellerRoute() {
  const { isAuthenticated, user, isLoading, refreshUser, logout } = useAuth();
  const { pathname } = useLocation();
  const session = useQuery({
    queryKey: ["seller-session", user?.id, pathname],
    queryFn: refreshUser,
    enabled: isAuthenticated && user?.role === "seller",
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: "always",
  });

  if (isLoading) return <FullScreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "seller" && user?.role !== "admin") return <Navigate to="/dashboard" replace />;

  if (user.role === "seller") {
    if (session.isPending) return <FullScreenLoader />;
    if (session.isError || !session.data) {
      return (
        <main className={s.page}>
          <div className={s.inner}>
            <p className={s.error} role="alert">No se pudo verificar el acceso a tu panel.</p>
            <div className={s.actions}>
              <button className={s.primaryButton} type="button" onClick={() => void session.refetch()} disabled={session.isFetching}>
                {session.isFetching ? "Verificando…" : "Reintentar"}
              </button>
              <button className={s.secondaryButton} type="button" onClick={logout}>Cerrar sesión</button>
            </div>
          </div>
        </main>
      );
    }
    if (session.data.influencer && pathname !== "/sellers/influencer") {
      return <Navigate to="/sellers/influencer" replace />;
    }
    if (!session.data.influencer && pathname === "/sellers/influencer") {
      return <Navigate to="/sellers" replace />;
    }
  } else if (pathname === "/sellers/influencer") {
    return <Navigate to="/sellers" replace />;
  }

  return <Outlet />;
}
