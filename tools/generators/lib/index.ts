import { type Tree, formatFiles, generateFiles } from "@nx/devkit";
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

  await formatFiles(tree);
}
