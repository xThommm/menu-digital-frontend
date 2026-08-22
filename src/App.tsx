import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./context/AuthProvider";
import { NotificationProvider } from "./context/NotificationProvider";
import AppRoutes from "./routes/AppRoutes";
import FullScreenLoader from "./components/Common/FullScreenLoader";

export default function App() {
  return (
    <BrowserRouter>
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
