import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const DebugInfo = () => {
  const { user, profile, loading } = useAuth();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDebugInfo = async () => {
      try {
        // Test Supabase connection
        const { data, error } = await supabase
          .from('products')
          .select('count()')
          .limit(1);
        
        setDebugInfo({
          user: user ? 'Authenticated' : 'Not authenticated',
          profile: profile ? 'Profile loaded' : 'No profile',
          loading: loading ? 'Loading' : 'Not loading',
          supabaseConnection: error ? `Error: ${error.message}` : 'Connected',
          productCount: data ? data[0].count : 'N/A'
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    if (!loading) {
      fetchDebugInfo();
    }
  }, [user, profile, loading]);

  if (process.env.NODE_ENV === 'production') {
    return null; // Don't show in production
  }

  return (
    <div className="fixed bottom-0 right-0 bg-red-100 border border-red-400 text-red-700 p-4 m-4 rounded z-50 max-w-md">
      <h3 className="font-bold">Debug Info</h3>
      <pre className="text-xs overflow-auto">
        {JSON.stringify(debugInfo, null, 2)}
      </pre>
      {error && <p className="text-red-500">Error: {error}</p>}
    </div>
  );
};

export default DebugInfo;