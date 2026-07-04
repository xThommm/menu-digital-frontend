import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./context/AuthProvider";
import AppRoutes from "./routes/AppRoutes";

const PageLoader = () => (
  <div className="pageLoaderScreen">
    <div className="pageLoaderRing" />
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <AppRoutes />
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}