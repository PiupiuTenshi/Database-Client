const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const buildOptions = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  external: ["vscode", "better-sqlite3", "pg"],
  format: "cjs",
  platform: "node",
  target: "node20",
  outfile: "dist/extension.js",
  sourcemap: !production,
  minify: production,
  logLevel: "info"
};

async function main() {
  if (watch) {
    const context = await esbuild.context(buildOptions);
    await context.watch();
    console.log("Watching extension bundle...");
    return;
  }

  await esbuild.build(buildOptions);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
