/** Map file path extension to Monaco language id. */
export function pathToMonacoLanguage(filePath: string): string {
  const base = filePath.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";

  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    mts: "typescript",
    cts: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    md: "markdown",
    mdx: "markdown",
    rs: "rust",
    py: "python",
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    svg: "xml",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    vue: "html",
    java: "java",
    kt: "kotlin",
    kts: "kotlin",
    go: "go",
    c: "c",
    h: "c",
    cpp: "cpp",
    cc: "cpp",
    cxx: "cpp",
    hpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    dart: "dart",
    dockerfile: "dockerfile",
  };

  if (base === "Dockerfile" || base.startsWith("Dockerfile.")) {
    return "dockerfile";
  }

  return map[ext] ?? "plaintext";
}
