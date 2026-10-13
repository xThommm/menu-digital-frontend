import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./context/AuthProvider";
import { NotificationProvider } from "./context/NotificationProvider";
import { ContextMenuProvider } from "./features/contextMenu/components/ContextMenuProvider";
import { getGlobalMenuItems } from "./features/contextMenu/globalMenu";
import AppRoutes from "./routes/AppRoutes";
import FullScreenLoader from "./components/Common/FullScreenLoader";
import HalloweenEffects from "./components/Halloween/HalloweenEffects";

export default function App() {
  return (
    <BrowserRouter>
      <HalloweenEffects />
      <NotificationProvider>
        <ContextMenuProvider getGlobalItems={getGlobalMenuItems}>
          <AuthProvider>
            <Suspense fallback={<FullScreenLoader />}>
              <AppRoutes />
            </Suspense>
          </AuthProvider>
        </ContextMenuProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}
