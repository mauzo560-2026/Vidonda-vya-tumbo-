import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VisitorFunnel } from './components/VisitorFunnel';
import { testConnection } from './firebase';

type AppRoute = 'funnel' | 'admin';

export default function App() {
  const [route, setRoute] = useState<AppRoute>(() =>
    window.location.pathname.startsWith('/admin') ? 'admin' : 'funnel'
  );

  useEffect(() => {
    void testConnection();

    const onPopState = () => {
      setRoute(window.location.pathname.startsWith('/admin') ? 'admin' : 'funnel');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (next: AppRoute) => {
    const targetPath = next === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setRoute(next);
  };

  return (
    <ErrorBoundary>
      {route === 'admin' ? (
        <AdminDashboard onBackToFunnel={() => navigate('funnel')} />
      ) : (
        <VisitorFunnel onOpenAdmin={() => navigate('admin')} />
      )}
    </ErrorBoundary>
  );
}
