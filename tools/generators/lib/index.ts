import { type Tree, formatFiles, generateFiles, updateJson } from "@nx/devkit";
import * as path from "node:path";

interface LibGeneratorSchema {
  name: string;
}

export default async function libGenerator(tree: Tree, options: LibGeneratorSchema) {
  const { name } = options;
  const projectRoot = `packages/${name}`;

  generateFiles(tree, path.join(__dirname, "files"), projectRoot, {
    name,
    tmpl: "",
  });

  updateJson(tree, "tsconfig.base.json", (json) => {
    json.compilerOptions.baseUrl ??= ".";
    const paths = json.compilerOptions.paths ?? {};
    paths[`@ralphy/${name}`] = [`${projectRoot}/src/${name}.ts`];
    json.compilerOptions.paths = paths;
    return json;
  });

  await formatFiles(tree);
}
