jest.mock("./auth-context", () => ({
  useAuth: () => ({
    user: {
      uid: "test-user",
      email: "person1@example.com",
      displayName: "Person 1",
      photoURL: null,
    },
    loading: false,
    firebaseReady: true,
    signOutUser: jest.fn(),
  }),
}));
