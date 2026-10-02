import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(() => {
  // Testes sempre usam .env.test (banco separado de dev/produção) —
  // nunca os dados reais.
  const env = loadEnv("test", process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  return {
    plugins: [tsconfigPaths()],
    resolve: {
      // Resolve "server-only" para um módulo vazio (em vez de lançar),
      // do mesmo jeito que o bundler do Next faz em Server Components —
      // sem isso, qualquer import de src/lib/data/* quebraria aqui.
      conditions: ["react-server"],
    },
    ssr: {
      resolve: {
        conditions: ["react-server"],
      },
    },
    test: {
      environment: "node",
      include: ["src/**/*.test.ts"],
      setupFiles: ["./src/test/setup.ts"],
      hookTimeout: 30000,
      testTimeout: 15000,
      // Testes de integração compartilham o mesmo banco de teste, então
      // rodam em sequência para evitar condições de corrida entre eles.
      fileParallelism: false,
    },
  };
});
