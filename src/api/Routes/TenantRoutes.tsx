import { Route } from "react-router-dom";
import { Fragment, lazy } from "react";

const UserHome = lazy(() => import("../../components/User/Home/Home/UserHome"));
const UserMenu = lazy(() => import("../../components/User/Home/Menu/UserMenu"));

export default function TenantRoutes() {
  return (
    <Fragment>
      <Route path="/:slug" element={<UserHome />} />
      <Route path="/:slug/menu" element={<UserMenu />} />
    </Fragment>
  );
}