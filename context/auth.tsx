import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { usernameToEmail } from '@/lib/username';

type UserRole = 'gabbai' | 'baal_kriya';

type Profile = {
  id: string;
  role: UserRole;
  synagogue_name: string | null;
  phone: string | null;
  nusach: string[] | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
};

type AuthContextType = {
  session: Session | null;
  profile: Profile | null;
  username: string | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createProfile: (data: {
    role: UserRole;
    synagogue_name?: string;
    phone?: string;
    nusach?: string[];
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => Promise<void>;
  updateProfile: (data: Partial<Omit<Profile, 'id' | 'created_at'>>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  const username = (session?.user?.user_metadata?.username as string) ?? null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }

    setIsProfileLoading(true);
    supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error?.code === 'PGRST116') {
          setProfile(null);
        } else if (data) {
          setProfile(data as Profile);
        }
        setIsProfileLoading(false);
      });
  }, [session?.user?.id]);

  const signIn = async (username: string, password: string) => {
    const email = usernameToEmail(username);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message === 'Invalid login credentials') {
        throw new Error('שם משתמש או סיסמה שגויים');
      }
      throw error;
    }
  };

  const signUp = async (username: string, password: string) => {
    const email = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    if (!data.session) throw new Error('ההרשמה נכשלה, נסה שוב');
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  };

  const createProfile = async (data: {
    role: UserRole;
    synagogue_name?: string;
    phone?: string;
    nusach?: string[];
    address?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', session!.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(newProfile as Profile);
  };

  const updateProfile = async (data: Partial<Omit<Profile, 'id' | 'created_at'>>) => {
    const { data: updated, error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', session!.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(updated as Profile);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        username,
        isLoading,
        isProfileLoading,
        signIn,
        signUp,
        signOut,
        createProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
