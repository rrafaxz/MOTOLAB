import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), [
    "NEXT_PUBLIC_SUPABASE_",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
  ]);

  const pairs = [
    [env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY],
    [env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY],
  ];
  const [url = "", key = ""] = pairs.find(([url, key]) => url && key) ?? [];

  return {
    define: {
      "import.meta.env.MOTOLAB_SUPABASE_URL": JSON.stringify(url),
      "import.meta.env.MOTOLAB_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(key),
    },
  };
});
