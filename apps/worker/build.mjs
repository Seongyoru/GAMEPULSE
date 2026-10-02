// Bundles the worker and CLI for production. Workspace packages (TypeScript sources) are
// bundled; third-party packages stay external and are resolved from node_modules at runtime,
// so every third-party package used by a workspace package must be a direct dependency here.
import { build } from 'esbuild';

const externalizeThirdParty = {
  name: 'externalize-third-party',
  setup(context) {
    context.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith('@gamepulse/')) return undefined;
      return { path: args.path, external: true };
    });
  },
};

await build({
  entryPoints: { main: 'src/main.ts', cli: 'src/cli.ts' },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  plugins: [externalizeThirdParty],
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
