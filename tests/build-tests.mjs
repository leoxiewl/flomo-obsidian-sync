import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const mainPath = path.join(root, 'main.ts');
const stubPath = path.join(root, 'tests/obsidian-stub.mjs');
const outfile = path.join(root, 'tests/dist/main.test.cjs');

const injectExports = {
  name: 'inject-test-exports',
  setup(build) {
    build.onLoad({ filter: /main\.ts$/ }, async (args) => {
      if (args.path !== mainPath) return null;
      const contents = fs.readFileSync(args.path, 'utf8') +
        '\nexport { computeFilePaths, memoToMarkdown, samePaths, syncToVault };\n';
      return { contents, loader: 'ts' };
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(root, 'tests/main.test.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { obsidian: stubPath },
  plugins: [injectExports],
  logLevel: 'silent',
});
