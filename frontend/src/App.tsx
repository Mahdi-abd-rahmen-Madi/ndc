import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './stores/useAppStore';
import { API_BASE_URL } from './services/apiClient';

// All route-level & heavy GIS workspaces are lazy-loaded so MapLibre (~800 kB)
// is never downloaded on Landing, Login, Account, or Catalogue pages.
const LandingPage = lazy(() => import('./components/LandingPage'));
const LoginView = lazy(() => import('./components/LoginView'));
const RegularUserView = lazy(() => import('./components/RegularUserView'));
const EngineerWorkspace = lazy(() => import('./components/EngineerWorkspace'));
const MontageSelectionModal = lazy(() => import('./components/MontageSelectionModal'));
const CatalogueTestView = lazy(() => import('./components/CatalogueTestView'));
const AccountView = lazy(() => import('./components/AccountView'));

const LoadingFallback = (
  <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">
    Chargement...
  </div>
);

export default function App() {
  const token = useAppStore((state) => state.token);
  const userEmail = useAppStore((state) => state.userEmail);
  const isAdmin = useAppStore((state) => state.isAdmin);
  const setAuth = useAppStore((state) => state.setAuth);
  const logout = useAppStore((state) => state.logout);

  const handleLoginSuccess = (newToken: string, email: string, adminStatus: boolean) => {
    setAuth(newToken, email, adminStatus);
  };

  return (
    <Suspense fallback={LoadingFallback}>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              token={token}
              userEmail={userEmail}
              isAdmin={isAdmin}
              onLogout={logout}
            />
          }
        />
        <Route
          path="/portail"
          element={
            <PortalRoute
              token={token}
              userEmail={userEmail}
              onLoginSuccess={handleLoginSuccess}
              onLogout={logout}
            />
          }
        />
        <Route path="/portal" element={<Navigate to="/portail" replace />} />
        <Route
          path="/compte"
          element={
            <AccountRoute
              token={token}
              userEmail={userEmail}
              onLogout={logout}
              onLoginSuccess={handleLoginSuccess}
            />
          }
        />
        <Route
          path="/engineer"
          element={
            <EngineerRoute
              token={token}
              isAdmin={isAdmin}
              onLoginSuccess={handleLoginSuccess}
            />
          }
        />
        <Route path="/test-catalogue" element={<CatalogueTestView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

interface PortalRouteProps {
  token: string | null;
  userEmail: string | null;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
  onLogout: () => void;
}

function PortalRoute({ token, userEmail, onLoginSuccess, onLogout }: PortalRouteProps) {
  const showMontageModal = useAppStore((state) => state.showMontageModal);
  const setShowMontageModal = useAppStore((state) => state.setShowMontageModal);
  const selectedCivilMontage = useAppStore((state) => state.selectedCivilMontage);
  const setSelectedCivilMontage = useAppStore((state) => state.setSelectedCivilMontage);
  const selectedSiteType = useAppStore((state) => state.selectedSiteType);
  const setSelectedSiteType = useAppStore((state) => state.setSelectedSiteType);
  const selectedFoundationType = useAppStore((state) => state.selectedFoundationType);

  if (!token) {
    return <LoginView apiBaseUrl={API_BASE_URL} onLoginSuccess={onLoginSuccess} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-100">
      <div className="flex-1 flex overflow-hidden w-full max-w-none">
        <RegularUserView
          apiBaseUrl={API_BASE_URL}
          initialMontage={selectedCivilMontage}
          initialSiteType={selectedSiteType}
          initialFoundationType={selectedFoundationType}
          onResetMontage={() => setShowMontageModal(true)}
          token={token}
          userEmail={userEmail!}
          onLogout={onLogout}
        />
      </div>

      {showMontageModal && (
        <Suspense fallback={null}>
          <MontageSelectionModal
            show={showMontageModal}
            onClose={() => setShowMontageModal(false)}
            selectedSiteType={selectedSiteType}
            onSiteTypeSelect={(type) => setSelectedSiteType(type)}
            onCasSelect={(cas) => setSelectedCivilMontage(cas)}
          />
        </Suspense>
      )}
    </div>
  );
}

interface EngineerRouteProps {
  token: string | null;
  isAdmin: boolean;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
}

function EngineerRoute({ token, isAdmin, onLoginSuccess }: EngineerRouteProps) {
  const showMontageModal = useAppStore((state) => state.showMontageModal);
  const setShowMontageModal = useAppStore((state) => state.setShowMontageModal);
  const setSelectedCivilMontage = useAppStore((state) => state.setSelectedCivilMontage);
  const selectedSiteType = useAppStore((state) => state.selectedSiteType);
  const setSelectedSiteType = useAppStore((state) => state.setSelectedSiteType);

  if (!token) {
    return <LoginView apiBaseUrl={API_BASE_URL} onLoginSuccess={onLoginSuccess} />;
  }
  if (!isAdmin) {
    return <Navigate to="/portail" replace />;
  }

  return (
    <>
      <EngineerWorkspace />
      {showMontageModal && (
        <Suspense fallback={null}>
          <MontageSelectionModal
            show={showMontageModal}
            onClose={() => setShowMontageModal(false)}
            selectedSiteType={selectedSiteType}
            onSiteTypeSelect={(type) => setSelectedSiteType(type)}
            onCasSelect={(cas) => setSelectedCivilMontage(cas)}
          />
        </Suspense>
      )}
    </>
  );
}

interface AccountRouteProps {
  token: string | null;
  userEmail: string | null;
  onLogout: () => void;
  onLoginSuccess: (token: string, email: string, isAdmin: boolean) => void;
}

function AccountRoute({ token, userEmail, onLogout, onLoginSuccess }: AccountRouteProps) {
  if (!token) {
    return <LoginView apiBaseUrl={API_BASE_URL} onLoginSuccess={onLoginSuccess} />;
  }

  return (
    <AccountView
      apiBaseUrl={API_BASE_URL}
      userEmail={userEmail}
      onLogout={onLogout}
    />
  );
}
