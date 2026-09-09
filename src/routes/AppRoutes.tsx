import { Route, Routes } from "react-router-dom";
import { lazy } from "react";
import RouteSEO from "../components/Common/RouteSeo";

import AdminRoute from "./AdminRoutes";
import SellerRoute from "./SellerRoutes";
import UserRoute from "./UserRoutes";

// ─────────────────────────────────────────────
// PUBLIC
// ─────────────────────────────────────────────

const Login = lazy(() => import("../../src/components/Login/Login"));
const Register = lazy(() => import("../../src/components/Register/Register"));
const RegisterPlans = lazy(
  () => import("../components/Register/RegisterPlans")
);
const RegisterSuccess = lazy(
  () => import("../components/Register/RegisterSuccess")
);
const VerifyEmail = lazy(
  () => import("../components/Register/VerifyEmail")
);

const Terms = lazy(() => import("../../src/pages/Legal/Terms"));
const Privacy = lazy(() => import("../../src/pages/Legal/Privacy"));
const Contact = lazy(() => import("../../src/pages/Legal/Contact"));
const Arrepentimiento = lazy(
  () => import("../../src/pages/Legal/Regret")
);
const Baja = lazy(
  () => import("../../src/pages/Legal/Unsubscribe")
);

// ─────────────────────────────────────────────
// CEO / ADMIN INTERNO
// ─────────────────────────────────────────────

const AdminHome = lazy(
  () => import("../../src/components/Admin/Home/AdminHome")
);

const AdminLayout = lazy(
  () => import("../../src/components/Admin/Panel/AdminLayout")
);

const CEODashboard = lazy(
  () => import("../../src/components/Admin/Panel/CEODashboard")
);

const AdminPayments = lazy(
  () => import("../../src/components/Admin/Payments/AdminPayments")
);

const AdminPlans = lazy(
  () => import("../components/Admin/Plans/AdminPlans")
);

const AdminSellers = lazy(
  () => import("../components/Admin/Sellers/AdminSellers")
);

// ─────────────────────────────────────────────
// SELLER
// ─────────────────────────────────────────────

const SellerLayout = lazy(
  () => import("../../src/components/Seller/SellerLayout")
);

const SellerOverview = lazy(
  () => import("../components/Seller/Overview/SellerOverview")
);

const SellerSimulation = lazy(
  () => import("../components/Seller/Simulation/SellerSimulation")
);

const SellerSettings = lazy(
  () => import("../components/Seller/Settings/SellerSettings")
);

const SellerRanking = lazy(
  () => import("../components/Seller/Ranking/SellerRanking")
);

const SellerCrm = lazy(
  () => import("../components/Seller/Crm/SellerCrm")
);

// ─────────────────────────────────────────────
// USER — DUEÑO DEL RESTAURANTE
// ─────────────────────────────────────────────

const DashboardLayout = lazy(
  () =>
    import(
      "../../src/components/User/Panel/DashboardLayout/DashboardLayout"
    )
);

const Dashboard = lazy(
  () =>
    import(
      "../../src/components/User/Panel/Dashboard/UserDashboard"
    )
);

const MenuEditor = lazy(
  () =>
    import(
      "../../src/components/User/Panel/MenuEditor/MenuEditor"
    )
);

const UserEditor = lazy(
  () =>
    import(
      "../../src/components/User/Panel/UserEditor/UserEditor"
    )
);

const UserStats = lazy(
  () =>
    import(
      "../../src/components/User/Panel/Stats/UserStats"
    )
);

// ─────────────────────────────────────────────
// TENANT PÚBLICO
// ─────────────────────────────────────────────

const UserHome = lazy(
  () =>
    import(
      "../../src/components/User/Home/Home/UserHome"
    )
);

const UserMenu = lazy(
  () =>
    import(
      "../../src/components/User/Home/Menu/UserMenu"
    )
);

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

export default function AppRoutes() {
  return (
    <>
      {/* SEO dinámico según la ruta actual */}
      <RouteSEO />

      <Routes>
        {/* ─────────────────────────────────────
            RUTAS PÚBLICAS
        ───────────────────────────────────── */}

        <Route
          path="/"
          element={<AdminHome />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route
          path="/register/plans"
          element={<RegisterPlans />}
        />

        <Route
          path="/register/success"
          element={<RegisterSuccess />}
        />

        <Route
          path="/verificar-email"
          element={<VerifyEmail />}
        />

        <Route
          path="/terminos"
          element={<Terms />}
        />

        <Route
          path="/privacidad"
          element={<Privacy />}
        />

        <Route
          path="/contacto"
          element={<Contact />}
        />

        <Route
          path="/arrepentimiento"
          element={<Arrepentimiento />}
        />

        <Route
          path="/baja"
          element={<Baja />}
        />

        {/* ─────────────────────────────────────
            ADMIN — SOLO ADMIN
        ───────────────────────────────────── */}

        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route
              path="/admin"
              element={<CEODashboard />}
            />

            <Route
              path="/admin/payments"
              element={<AdminPayments />}
            />

            <Route
              path="/admin/plans"
              element={<AdminPlans />}
            />

            <Route
              path="/admin/sellers"
              element={<AdminSellers />}
            />
          </Route>
        </Route>

        {/* ─────────────────────────────────────
            SELLERS — SELLER O ADMIN
        ───────────────────────────────────── */}

        <Route element={<SellerRoute />}>
          <Route element={<SellerLayout />}>
            <Route
              path="/sellers"
              element={<SellerOverview />}
            />

            <Route
              path="/sellers/simulacion"
              element={<SellerSimulation />}
            />

            <Route
              path="/sellers/configuracion"
              element={<SellerSettings />}
            />

            <Route
              path="/sellers/ranking"
              element={<SellerRanking />}
            />

            <Route
              path="/sellers/crm"
              element={<SellerCrm />}
            />
          </Route>
        </Route>

        {/* ─────────────────────────────────────
            USUARIOS — DUEÑOS DE RESTAURANTE
        ───────────────────────────────────── */}

        <Route element={<UserRoute />}>
          <Route element={<DashboardLayout />}>
            <Route
              path="/dashboard"
              element={<Dashboard />}
            />

            <Route
              path="/menu/editor"
              element={<MenuEditor />}
            />

            <Route
              path="/user/editor"
              element={<UserEditor />}
            />

            <Route
              path="/estadisticas"
              element={<UserStats />}
            />
          </Route>
        </Route>

        {/* ─────────────────────────────────────
            TENANT PÚBLICO
            Siempre al final para no pisar
            las rutas fijas anteriores.
        ───────────────────────────────────── */}

        <Route
          path="/:slug"
          element={<UserHome />}
        />

        <Route
          path="/:slug/menu"
          element={<UserMenu />}
        />
      </Routes>
    </>
  );
}