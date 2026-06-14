import { Route, Routes } from "react-router-dom";
import { lazy } from "react";

import AdminRoute from "./AdminRoutes";
import UserRoute from "./UserRoutes";
import Terms   from "../../pages/Legal/Terms";
import Privacy from "../../pages/Legal/Privacy";
import Contact from "../../pages/Legal/Contact";

// Public
const Login    = lazy(() => import("../../components/Login/Login"));
const Register = lazy(() => import("../../components/Register/Register"));

// CEO / Admin interno
const AdminHome    = lazy(() => import("../../components/Admin/Home/AdminHome"));
const CEODashboard = lazy(() => import("../../components/Admin/Panel/CEODashboard")); // era PanelHome

// User (dueño del restaurante autenticado)
const Dashboard  = lazy(() => import("../../components/User/Panel/Dashboard/UserDashboard"));
const MenuEditor = lazy(() => import("../../components/User/Panel/MenuEditor/MenuEditor"));
const UserEditor = lazy(() => import("../../components/User/Panel/UserEditor/UserEditor"));

// Tenant (landing pública por slug)
const UserHome = lazy(() => import("../../components/User/Home/Home/UserHome"));
const UserMenu = lazy(() => import("../../components/User/Home/Menu/UserMenu"));

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

      {/* Rutas protegidas — solo dueños de restaurante */}
      <Route element={<UserRoute />}>
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/menu/editor" element={<MenuEditor />} />
        <Route path="/user/editor" element={<UserEditor />} />
      </Route>

      {/* Tenant público por slug — siempre al final para no pisar rutas fijas */}
      <Route path="/:slug"      element={<UserHome />} />
      <Route path="/:slug/menu" element={<UserMenu />} />
    </Routes>
  );
}