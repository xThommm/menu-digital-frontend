import { Route } from "react-router-dom";
import { Fragment, lazy } from "react";

const AdminHome = lazy(() => import("../../components/Admin/Panel/CEODashboard"));
const Login = lazy(() => import("../../components/Login/Login"));
const Register = lazy(() => import("../../components/Register/Register"));

export default function PublicRoutes() {
  return (
    <Fragment>
      <Route path="/" element={<AdminHome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Fragment>
  );
}