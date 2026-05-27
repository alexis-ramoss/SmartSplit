import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../auth-context";
import { auth } from "../firebase";

export default function LoginScreen() {
  const router = useRouter();
  const { user, loading, firebaseReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return <View style={styles.loadingScreen} />;
  }

  if (user) {
    return <Redirect href="/" />;
  }

  async function handleLogin() {
    if (!auth || !firebaseReady) {
      setError("Add the Firebase config values first.");
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Enter email and password.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await auth.signInWithEmailAndPassword(trimmedEmail, trimmedPassword);
      router.replace("/");
    } catch {
      setError("Invalid login. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>SmartSplit</Text>
          <Text style={styles.title}>Sign in to your household</Text>
          <Text style={styles.subtitle}>
            Use your Firebase Auth email and password to open the app.
          </Text>
        </View>

        <View style={styles.formCard}>
          {!firebaseReady ? (
            <Text style={styles.noticeText}>
              Firebase is not configured yet. Add the EXPO_PUBLIC_FIREBASE_* values first.
            </Text>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="name@example.com"
            placeholderTextColor="#8A96A5"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="password"
            placeholder="Your password"
            placeholderTextColor="#8A96A5"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityLabel="Login"
            style={({ pressed }) => [
              styles.button,
              (pressed || busy) && styles.buttonPressed,
            ]}
            onPress={handleLogin}
            disabled={busy}
          >
            <Text style={styles.buttonText}>{busy ? "Signing in..." : "Login"}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F7FF",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F5F7FF",
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#E0E7FF",
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  kicker: {
    color: "#6366F1",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: "#1E1B4B",
    fontSize: 28,
    fontWeight: "800",
    marginTop: 10,
    lineHeight: 34,
  },
  subtitle: {
    color: "#4338CA",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    shadowColor: "#6366F1",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  noticeText: {
    color: "#8A4B00",
    backgroundColor: "#FFF4E5",
    borderRadius: 12,
    padding: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  label: {
    color: "#4338CA",
    fontSize: 15,
    fontWeight: "700",
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E7FF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1E1B4B",
    backgroundColor: "#FAFEFF",
  },
  errorText: {
    color: "#B42318",
    backgroundColor: "#FFF1F0",
    borderRadius: 12,
    padding: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  button: {
    marginTop: 10,
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.88,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
});
