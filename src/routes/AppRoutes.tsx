import { Route, Routes } from "react-router-dom";
import { lazy } from "react";

import AdminRoute from "./AdminRoutes";
import UserRoute from "./UserRoutes";

// Public
const Login    = lazy(() => import("../../src/components/Login/Login"));
const Register = lazy(() => import("../../src/components/Register/Register"));
const RegisterPlans = lazy(() => import("../components/Register/RegisterPlans"));
const RegisterSuccess = lazy(() => import("../components/Register/RegisterSuccess"));
const Terms   = lazy(() => import("../../src/pages/Legal/Terms"));
const Privacy = lazy(() => import("../../src/pages/Legal/Privacy"));
const Contact = lazy(() => import("../../src/pages/Legal/Contact"));
const Arrepentimiento = lazy(() => import("../../src/pages/Legal/Regret"));
const Baja = lazy(() => import("../../src/pages/Legal/Unsubscribe"));

// CEO / Admin interno
const AdminHome    = lazy(() => import("../../src/components/Admin/Home/AdminHome"));
const AdminLayout  = lazy(() => import("../../src/components/Admin/Panel/AdminLayout"));
const CEODashboard = lazy(() => import("../../src/components/Admin/Panel/CEODashboard"));
const CrmClients   = lazy(() => import("../../src/components/Admin/Crm/CrmClients"));
const AdminPayments = lazy(() => import("../../src/components/Admin/Payments/AdminPayments"));
const AdminPlans = lazy(() => import("../components/Admin/Plans/AdminPlans"));
const AdminSellers = lazy(() => import("../components/Admin/Sellers/AdminSellers"));
const SellerMetricsPanel = lazy(() => import("../components/Admin/Sellers/SellerMetricsPanel"));
const SellerCommissions = lazy(() => import("../components/Admin/Sellers/SellerCommissions"));

// User (dueño del restaurante autenticado)
const DashboardLayout = lazy(() => import("../../src/components/User/Panel/DashboardLayout/DashboardLayout"));
const Dashboard  = lazy(() => import("../../src/components/User/Panel/Dashboard/UserDashboard"));
const MenuEditor = lazy(() => import("../../src/components/User/Panel/MenuEditor/MenuEditor"));
const UserEditor = lazy(() => import("../../src/components/User/Panel/UserEditor/UserEditor"));
const UserStats  = lazy(() => import("../../src/components/User/Panel/Stats/UserStats"));

// Tenant (landing pública por slug)
const UserHome = lazy(() => import("../../src/components/User/Home/Home/UserHome"));
const UserMenu = lazy(() => import("../../src/components/User/Home/Menu/UserMenu"));

export default function AppRoutes() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/"          element={<AdminHome />} />
      <Route path="/login"     element={<Login />} />
      <Route path="/register"  element={<Register />} />
      <Route path="/register/plans" element={<RegisterPlans />} />
      <Route path="/register/success" element={<RegisterSuccess />} />
      <Route path="/terminos"  element={<Terms />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/contacto"  element={<Contact />} />
      <Route path="/arrepentimiento" element={<Arrepentimiento />} />
      <Route path="/baja" element={<Baja />} />
      {/* Rutas protegidas — solo admins (CEOs), con sidebar/bottomnav persistente */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin"     element={<CEODashboard />} />
          <Route path="/admin/crm" element={<CrmClients />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/plans" element={<AdminPlans />} />
          <Route path="/admin/sellers" element={<AdminSellers />} />
          <Route path="/admin/sellers/metricas" element={<SellerMetricsPanel />} />
          <Route path="/admin/sellers/comisiones" element={<SellerCommissions />} />
        </Route>
      </Route>

      {/* Rutas protegidas — solo dueños de restaurante, con sidebar persistente */}
      <Route element={<UserRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/menu/editor"   element={<MenuEditor />} />
          <Route path="/user/editor"   element={<UserEditor />} />
          <Route path="/estadisticas"  element={<UserStats />} />
        </Route>
      </Route>

      {/* Tenant público por slug — siempre al final para no pisar rutas fijas */}
      <Route path="/:slug"      element={<UserHome />} />
      <Route path="/:slug/menu" element={<UserMenu />} />
    </Routes>
  );
}
