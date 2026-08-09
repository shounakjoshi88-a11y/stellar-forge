import tailwind from "bun-plugin-tailwind";
import { rm, cp } from "node:fs/promises";
import path from "node:path";

const outdir = path.join(process.cwd(), "dist");
await rm(outdir, { recursive: true, force: true });

const entrypoints = [...new Bun.Glob("src/**/*.html").scanSync()];

const envDefine: Record<string, string> = {};
for (const [key, value] of Object.entries(process.env)) {
  if (key.startsWith("BUN_PUBLIC_")) {
    envDefine[`process.env.${key}`] = JSON.stringify(value ?? "");
  }
}

const result = await Bun.build({
  entrypoints,
  outdir,
  plugins: [tailwind],
  minify: true,
  target: "browser",
  splitting: true,
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.browser": "true",
    "process.version": JSON.stringify(""),
    ...envDefine,
  },
});

if (!result.success) {
  console.error(result.logs);
  process.exit(1);
}

for (const output of result.outputs) {
  console.log(` ${path.relative(process.cwd(), output.path)}  ${(output.size / 1024).toFixed(1)} KB`);
}

// Ship the audio sprite (recorded paper-tear, CC0) verbatim into the build.
await cp(path.join(process.cwd(), "src", "audio"), path.join(outdir, "audio"), {
  recursive: true,
  force: true,
});
console.log(" copied src/audio → dist/audio");
