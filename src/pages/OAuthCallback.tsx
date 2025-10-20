import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    console.log('=== OAUTH CALLBACK DEBUG INFO ===');
    console.log('Window location:', window.location);
    console.log('Window location href:', window.location.href);
    console.log('Window location search:', window.location.search);
    console.log('Full URL object:', {
      href: window.location.href,
      origin: window.location.origin,
      pathname: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
    console.log('User state:', user);
    console.log('==============================');
    
    const handleOAuthCallback = async () => {
      // Get the URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      const errorDescription = params.get('error_description');
      const state = params.get('state');
      const scope = params.get('scope');
      
      console.log('All URL parameters:', {
        code,
        error,
        errorDescription,
        state,
        scope
      });
      
      // Handle OAuth errors
      if (error) {
        console.error('OAuth error from Google:', error, 'Description:', errorDescription);
        navigate('/auth?error=oauth_failed&message=' + encodeURIComponent(errorDescription || error));
        return;
      }
      
      if (code) {
        try {
          console.log('Exchanging code for session:', code);
          // Exchange the code for a session
          const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);
          
          console.log('Exchange result:', { data, error: exchangeError });
          
          if (exchangeError) {
            console.error('Error exchanging code for session:', exchangeError);
            navigate('/auth?error=session_failed&message=' + encodeURIComponent(exchangeError.message));
          } else {
            // Successfully signed in, redirect to home
            console.log('OAuth successful, redirecting to home. Session data:', data);
            navigate('/');
          }
        } catch (exchangeException: any) {
          console.error('Exception during OAuth callback:', exchangeException);
          navigate('/auth?error=exception&message=' + encodeURIComponent(exchangeException.message || 'Unknown error'));
        }
      } else {
        // No code in URL, redirect to auth page
        console.log('No code in URL, redirecting to auth');
        // Let's also check if there might be other parameters
        const allParams = Array.from(params.entries());
        console.log('All parameters in URL:', allParams);
        
        // Check if we're on the right path
        if (window.location.pathname !== '/auth/callback') {
          console.error('Not on the expected callback path');
          navigate('/auth?error=wrong_path&message=Not+on+the+expected+callback+path');
        } else {
          navigate('/auth?error=no_code&message=No+authorization+code+received');
        }
      }
    };

    // Only handle callback if user is not already authenticated
    if (!user) {
      handleOAuthCallback();
    } else {
      // User is already authenticated, redirect to home
      console.log('User already authenticated, redirecting to home. User:', user);
      navigate('/');
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <div className="ml-4">Processing authentication...</div>
    </div>
  );
}