import { Route, Routes } from "react-router-dom";
import { lazy } from "react";

import AdminRoute from "./AdminRoutes";
import UserRoute from "./UserRoutes";

// Public
const Login    = lazy(() => import("../../src/components/Login/Login"));
const Register = lazy(() => import("../../src/components/Register/Register"));
const Terms   = lazy(() => import("../../src/pages/Legal/Terms"));
const Privacy = lazy(() => import("../../src/pages/Legal/Privacy"));
const Contact = lazy(() => import("../../src/pages/Legal/Contact"));

// CEO / Admin interno
const AdminHome    = lazy(() => import("../../src/components/Admin/Home/AdminHome"));
const CEODashboard = lazy(() => import("../../src/components/Admin/Panel/CEODashboard"));

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
      <Route path="/terminos"  element={<Terms />} />
      <Route path="/privacidad" element={<Privacy />} />
      <Route path="/contacto"  element={<Contact />} />

      {/* Rutas protegidas — solo admins (CEOs) */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<CEODashboard />} />
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