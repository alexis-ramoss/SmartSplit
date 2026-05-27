import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { auth, db, hasRequiredConfig } from "./firebase";

type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  firebaseReady: boolean;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  firebaseReady: false,
  signOutUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((nextUser) => {
      if (!nextUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      setUser({
        uid: nextUser.uid,
        email: nextUser.email,
        displayName: nextUser.displayName,
        photoURL: nextUser.photoURL,
      });

      if (db) {
        void db.collection("users").doc(nextUser.uid).set(
          {
            uid: nextUser.uid,
            name: nextUser.displayName || nextUser.email?.split("@")[0] || "User",
            email: nextUser.email || "",
            photo: nextUser.photoURL || "",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      firebaseReady: hasRequiredConfig,
      signOutUser: async () => {
        if (!auth) {
          return;
        }

        await auth.signOut();
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}