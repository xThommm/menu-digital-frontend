import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import { AuthProvider } from "./context/AuthProvider";
import AppRoutes from "./routes/AppRoutes";

const PageLoader = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
    }}
  >
    <div className="loader" />
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