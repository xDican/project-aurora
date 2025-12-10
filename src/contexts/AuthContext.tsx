import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "receptionist";

interface AppUser {
  id: string;
  auth_user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  currentUser: AppUser | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrCreateUser = async (authUser: User) => {
    // Try to fetch existing user
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching user:", fetchError);
      return null;
    }

    if (existingUser) {
      return existingUser as AppUser;
    }

    // User doesn't exist, create one
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUser.id,
        email: authUser.email || "",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating user:", insertError);
      return null;
    }

    return newUser as AppUser;
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          // Defer Supabase calls with setTimeout to avoid deadlocks
          setTimeout(async () => {
            const user = await fetchOrCreateUser(session.user);
            setCurrentUser(user);
            setLoading(false);
          }, 0);
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchOrCreateUser(session.user).then((user) => {
          setCurrentUser(user);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        currentUser,
        role: currentUser?.role ?? null,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
