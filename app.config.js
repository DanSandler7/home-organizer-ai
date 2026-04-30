export default {
  expo: {
    name: "Home Organizer AI",
    slug: "home-organizer-ai",
    version: "1.0.0",
    android: {
      package: "com.dansandler7.homeorganizerai"
    },
    extra: {
      eas: {
        projectId: "eb10d9b6-596b-4d91-a46e-bd8ebd352afd"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    }
  }
};
