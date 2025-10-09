import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Log the current URL for debugging
      console.log('OAuth callback URL:', window.location.href);
      
      // Get the URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      
      // Log parameters for debugging
      console.log('OAuth params - code:', code, 'error:', error);
      
      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error);
        navigate('/auth?error=oauth_failed');
        return;
      }
      
      if (code) {
        try {
          // Exchange the code for a session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('Error exchanging code for session:', exchangeError);
            navigate('/auth?error=session_failed');
          } else {
            // Successfully signed in, redirect to home
            console.log('OAuth successful, redirecting to home');
            navigate('/');
          }
        } catch (exchangeException) {
          console.error('Exception during OAuth callback:', exchangeException);
          navigate('/auth?error=exception');
        }
      } else {
        // No code in URL, redirect to auth page
        console.log('No code in URL, redirecting to auth');
        navigate('/auth');
      }
    };

    // Only handle callback if user is not already authenticated
    if (!user) {
      handleOAuthCallback();
    } else {
      // User is already authenticated, redirect to home
      console.log('User already authenticated, redirecting to home');
      navigate('/');
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}