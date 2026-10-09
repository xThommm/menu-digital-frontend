import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./context/AuthProvider";
import { NotificationProvider } from "./context/NotificationProvider";
import AppRoutes from "./routes/AppRoutes";
import FullScreenLoader from "./components/Common/FullScreenLoader";
import HalloweenEffects from "./components/Halloween/HalloweenEffects";

export default function App() {
  return (
    <BrowserRouter>
      <HalloweenEffects />
      <NotificationProvider>
        <AuthProvider>
          <Suspense fallback={<FullScreenLoader />}>
            <AppRoutes />
          </Suspense>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}
