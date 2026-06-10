import { Route, Routes } from "react-router-dom";
import { lazy } from "react";

import AdminRoute from "./AdminRoutes";
import UserRoute from "./UserRoutes";

// Public
const Login = lazy(() => import("../../components/Login/Login"));
const Register = lazy(() => import("../../components/Register/Register"));

// Admin
const AdminHome = lazy(() => import("../../components/Admin/Home/AdminHome"));
const PanelHome = lazy(() => import("../../components/Admin/Panel/PanelHome"));

// User (authenticated)
const Dashboard  = lazy(() => import("../../components/User/Panel/Dashboard/UserDashboard"));
const MenuEditor = lazy(() => import("../../components/User/Panel/MenuEditor/MenuEditor"));
const UserEditor = lazy(() => import("../../components/User/Panel/UserEditor/UserEditor"));

// Tenant (public slugs)
const UserHome = lazy(() => import("../../components/User/Home/Home/UserHome"));
const UserMenu = lazy(() => import("../../components/User/Home/Menu/UserMenu"));

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<AdminHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Admin-protected routes */}
      <Route element={<AdminRoute />}>
        <Route path="/admin" element={<PanelHome />} />
      </Route>

      {/* User-protected routes */}
      <Route element={<UserRoute />}>
        <Route path="/dashboard"   element={<Dashboard />} />
        <Route path="/menu/editor" element={<MenuEditor />} />
        <Route path="/user/editor" element={<UserEditor />} />
      </Route>

      {/* Tenant public routes (slug-based) — must go last to avoid conflicts */}
      <Route path="/:slug" element={<UserHome />} />
      <Route path="/:slug/menu" element={<UserMenu />} />
    </Routes>
  );
}