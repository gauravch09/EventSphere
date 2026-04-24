import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const Auth: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const { signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const isOrganizer = type === 'organizer';

  React.useEffect(() => {
    if (user) {
      navigate(isOrganizer ? '/dashboard' : '/');
    }
  }, [user, navigate, isOrganizer]);

  const handleSignIn = async () => {
    await signInWithGoogle(isOrganizer ? 'organizer' : 'user');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className={cn(
          "bg-surface-container-lowest rounded-[2.5rem] p-10 shadow-2xl border border-outline-variant/10 text-center relative overflow-hidden",
          isOrganizer ? "border-primary/20" : "border-secondary/20"
        )}>
          {/* Background Accent */}
          <div className={cn(
            "absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20",
            isOrganizer ? "bg-primary" : "bg-secondary"
          )} />
          
          <div className="relative z-10">
            <div className={cn(
              "w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg",
              isOrganizer ? "bg-primary text-on-primary" : "bg-secondary text-on-secondary"
            )}>
              <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isOrganizer ? 'business_center' : 'person'}
              </span>
            </div>

            <h1 className="text-4xl font-black tracking-tighter font-headline mb-4">
              {isOrganizer ? 'Organizer Portal' : 'Attendee Access'}
            </h1>
            <p className="text-on-surface-variant font-medium mb-10 leading-relaxed">
              {isOrganizer 
                ? 'Host events, manage tickets, and grow your community with Event Sphere.' 
                : 'Discover the best events in your city and secure your spot in seconds.'}
            </p>

            <button 
              onClick={handleSignIn}
              className={cn(
                "w-full py-4 rounded-2xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 mb-6",
                isOrganizer 
                  ? "bg-primary text-on-primary shadow-primary/20" 
                  : "bg-secondary text-on-secondary shadow-secondary/20"
              )}
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="h-px flex-grow bg-outline-variant/20" />
              <span className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Switch Role</span>
              <div className="h-px flex-grow bg-outline-variant/20" />
            </div>

            <Link 
              to={isOrganizer ? '/auth/attendee' : '/auth/organizer'}
              className="text-sm font-bold text-on-surface-variant hover:text-primary transition-colors"
            >
              {isOrganizer ? 'Sign in as an Attendee instead' : 'Are you an Organizer? Click here'}
            </Link>
          </div>
        </div>
        
        <p className="text-center mt-8 text-xs text-on-surface-variant font-medium">
          By continuing, you agree to Event Sphere's <br/>
          <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
