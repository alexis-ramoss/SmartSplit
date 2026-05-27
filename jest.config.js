module.exports = {
  preset: "jest-expo",
  watchman: false,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.expo/", "<rootDir>/node_modules/"],
};
