import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import DebugDbTest from "./pages/DebugDbTest";
import Rooms from "./pages/Rooms";
import Guests from "./pages/Guests";
import Reservas from "./pages/Reservas";
import Hoy from "./pages/Hoy";
import Mapa from "./pages/Mapa";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/hoy" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hoy"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Hoy />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/rooms"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Rooms />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/guests"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Guests />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/reservas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Reservas />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/mapa"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Mapa />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/debug/db-test"
              element={
                <ProtectedRoute>
                  <Layout>
                    <DebugDbTest />
                  </Layout>
                </ProtectedRoute>
              }
            />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
