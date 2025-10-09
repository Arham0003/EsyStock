import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Get the URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code) {
        try {
          // Exchange the code for a session
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Error exchanging code for session:', error);
            navigate('/auth');
          } else {
            // Successfully signed in, redirect to home
            navigate('/');
          }
        } catch (error) {
          console.error('Error during OAuth callback:', error);
          navigate('/auth');
        }
      } else {
        // No code in URL, redirect to auth page
        navigate('/auth');
      }
    };

    // Only handle callback if user is not already authenticated
    if (!user) {
      handleOAuthCallback();
    } else {
      // User is already authenticated, redirect to home
      navigate('/');
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
}