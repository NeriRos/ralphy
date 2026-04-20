/**
 * AST helpers for the prop-drilling check.
 *
 * Parses a .tsx file with oxc-parser and produces a FileInfo describing the
 * components it declares: their destructured props, which props are read in
 * the body, which props are forwarded to which child JSX elements, and the
 * file's import map (so the caller can resolve child JSX identifiers back to
 * component declarations).
 */

import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseSync } from "oxc-parser";

const IGNORE_MARKER = "prop-drill-ignore";
const NEWLINE_CODE = 10;

type AstNode = { type: string; [key: string]: unknown };

function isAstNode(value: unknown): value is AstNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

function toAstNodes(value: unknown): AstNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isAstNode);
}

export interface Forward {
  childJsxName: string;
  asName: string;
  viaSpread: boolean;
}

export interface ComponentInfo {
  file: string;
  name: string;
  declaredProps: string[];
  propReads: Set<string>;
  propForwards: Map<string, Forward[]>;
  signatureLine: number;
  ignored: boolean;
}

export interface FileInfo {
  file: string;
  imports: Map<string, string>;
  components: Map<string, ComponentInfo>;
}

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i += 1) {
    if (source.charCodeAt(i) === NEWLINE_CODE) line += 1;
  }
  return line;
}

function isIgnored(source: string, index: number): boolean {
  const lineStart = source.lastIndexOf("\n", index) + 1;
  const nextNewline = source.indexOf("\n", index);
  const end = nextNewline === -1 ? source.length : nextNewline;
  if (source.slice(lineStart, end).includes(IGNORE_MARKER)) return true;
  let cursor = lineStart - 1;
  while (cursor > 0) {
    const prevStart = source.lastIndexOf("\n", cursor - 1) + 1;
    const prev = source.slice(prevStart, cursor).trim();
    if (prev.startsWith("//")) {
      if (prev.includes(IGNORE_MARKER)) return true;
      cursor = prevStart - 1;
      continue;
    }
    break;
  }
  return false;
}

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z\d]*$/.test(name);
}

export async function resolveRelativeImport(args: {
  fromFile: string;
  source: string;
}): Promise<string | null> {
  if (!args.source.startsWith(".")) return null;
  const base = resolve(dirname(args.fromFile), args.source);
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ];
  for (const candidate of candidates) {
    try {
      const info = await stat(candidate);
      if (info.isFile()) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function getRestElementName(p: AstNode): string | null {
  const arg = p.argument as AstNode | undefined;
  if (arg?.type === "Identifier" && typeof arg.name === "string") return arg.name;
  return null;
}

function getPropertyKeyName(p: AstNode): string | null {
  if (p.type !== "Property") return null;
  const key = p.key as AstNode | undefined;
  if (key?.type === "Identifier" && typeof key.name === "string") return key.name;
  return null;
}

function collectTopLevelDestructuredNames(param: AstNode): string[] | null {
  if (param.type !== "ObjectPattern") return null;
  const props = param.properties as AstNode[] | undefined;
  if (!props) return [];
  const names: string[] = [];
  for (const p of props) {
    const name = p.type === "RestElement" ? getRestElementName(p) : getPropertyKeyName(p);
    if (name) names.push(name);
  }
  return names;
}

function findComponentParam(decl: AstNode): AstNode | null {
  const params = decl.params as AstNode[] | undefined;
  if (!params || params.length === 0) return null;
  const first = params[0];
  if (first?.type === "AssignmentPattern") {
    const left = first.left as AstNode | undefined;
    return left ?? null;
  }
  return first ?? null;
}

function getJsxElementName(opening: AstNode): string | null {
  const nameNode = opening.name as AstNode | undefined;
  if (nameNode?.type === "JSXIdentifier" && typeof nameNode.name === "string") {
    return nameNode.name;
  }
  return null;
}

interface WalkContext {
  forwardedIdentifiers: Set<AstNode>;
  forwards: Map<string, Forward[]>;
  declaredProps: Set<string>;
  reads: Set<string>;
}

function recordSpreadForward(args: { jsxName: string; ctx: WalkContext }): void {
  for (const declared of args.ctx.declaredProps) {
    const list = args.ctx.forwards.get(declared) ?? [];
    list.push({ childJsxName: args.jsxName, asName: declared, viaSpread: true });
    args.ctx.forwards.set(declared, list);
  }
}

interface ParsedAttrForward {
  attrName: string;
  expr: AstNode;
  propName: string;
}

function parseAttributeForward(args: {
  attr: AstNode;
  declared: Set<string>;
}): ParsedAttrForward | null {
  const attrName = args.attr.name as AstNode | undefined;
  const value = args.attr.value as AstNode | undefined;
  if (attrName?.type !== "JSXIdentifier" || typeof attrName.name !== "string") return null;
  if (!value || value.type !== "JSXExpressionContainer") return null;
  const expr = value.expression as AstNode | undefined;
  if (expr?.type !== "Identifier" || typeof expr.name !== "string") return null;
  if (!args.declared.has(expr.name)) return null;
  return { attrName: attrName.name, expr, propName: expr.name };
}

function recordAttributeForward(args: { jsxName: string; attr: AstNode; ctx: WalkContext }): void {
  const parts = parseAttributeForward({ attr: args.attr, declared: args.ctx.declaredProps });
  if (!parts) return;
  const forwards = args.ctx.forwards.get(parts.propName) ?? [];
  forwards.push({ childJsxName: args.jsxName, asName: parts.attrName, viaSpread: false });
  args.ctx.forwards.set(parts.propName, forwards);
  args.ctx.forwardedIdentifiers.add(parts.expr);
}

function visitJsxAttributes(opening: AstNode, ctx: WalkContext): void {
  const jsxName = getJsxElementName(opening);
  if (!jsxName || !isPascalCase(jsxName)) return;
  const attrs = opening.attributes as AstNode[] | undefined;
  if (!attrs) return;
  for (const attr of attrs) {
    if (attr.type === "JSXSpreadAttribute") recordSpreadForward({ jsxName, ctx });
    else if (attr.type === "JSXAttribute") recordAttributeForward({ jsxName, attr, ctx });
  }
}

function recordIdentifierRead(node: AstNode, ctx: WalkContext): void {
  if (typeof node.name !== "string") return;
  if (!ctx.declaredProps.has(node.name)) return;
  if (ctx.forwardedIdentifiers.has(node)) return;
  ctx.reads.add(node.name);
}

const SKIPPED_AST_KEYS = new Set(["start", "end", "loc", "range"]);

function walkChildren(parent: AstNode, ctx: WalkContext): void {
  for (const key of Object.keys(parent)) {
    if (SKIPPED_AST_KEYS.has(key)) continue;
    const value = parent[key];
    if (Array.isArray(value)) {
      for (const item of value) walkBody(item, ctx);
    } else if (value && typeof value === "object") {
      walkBody(value, ctx);
    }
  }
}

function walkBody(node: unknown, ctx: WalkContext): void {
  if (!node || typeof node !== "object") return;
  const ast = node as AstNode;
  if (ast.type === "JSXOpeningElement") visitJsxAttributes(ast, ctx);
  else if (ast.type === "Identifier") recordIdentifierRead(ast, ctx);
  walkChildren(ast, ctx);
}

interface BuildInput {
  file: string;
  name: string;
  decl: AstNode;
  signatureIndex: number;
  source: string;
}

function buildComponentInfo(input: BuildInput): ComponentInfo | null {
  const param = findComponentParam(input.decl);
  if (!param) return null;
  const declared = collectTopLevelDestructuredNames(param);
  if (!declared || declared.length === 0) return null;
  const ctx: WalkContext = {
    forwardedIdentifiers: new Set(),
    forwards: new Map(),
    declaredProps: new Set(declared),
    reads: new Set(),
  };
  const body = input.decl.body as AstNode | undefined;
  if (body) walkBody(body, ctx);
  return {
    file: input.file,
    name: input.name,
    declaredProps: declared,
    propReads: ctx.reads,
    propForwards: ctx.forwards,
    signatureLine: lineAt(input.source, input.signatureIndex),
    ignored: isIgnored(input.source, input.signatureIndex),
  };
}

interface ExtractInput {
  file: string;
  source: string;
  node: AstNode;
}

function fromFunctionDeclaration(input: ExtractInput): ComponentInfo | null {
  const id = input.node.id as AstNode | undefined;
  if (id?.type !== "Identifier" || typeof id.name !== "string") return null;
  if (!isPascalCase(id.name)) return null;
  const idx = typeof input.node.start === "number" ? input.node.start : 0;
  return buildComponentInfo({
    file: input.file,
    name: id.name,
    decl: input.node,
    signatureIndex: idx,
    source: input.source,
  });
}

function componentFromDeclarator(decl: AstNode, input: ExtractInput): ComponentInfo | null {
  const idNode = decl.id as AstNode | undefined;
  if (idNode?.type !== "Identifier" || typeof idNode.name !== "string") return null;
  if (!isPascalCase(idNode.name)) return null;
  const init = decl.init as AstNode | undefined;
  if (!init) return null;
  if (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression") return null;
  const idx = typeof decl.start === "number" ? decl.start : 0;
  return buildComponentInfo({
    file: input.file,
    name: idNode.name,
    decl: init,
    signatureIndex: idx,
    source: input.source,
  });
}

function fromVariableDeclaration(input: ExtractInput): ComponentInfo | null {
  const declarations = input.node.declarations as AstNode[] | undefined;
  if (!declarations) return null;
  for (const decl of declarations) {
    const info = componentFromDeclarator(decl, input);
    if (info) return info;
  }
  return null;
}

function extractComponentFromDeclaration(input: ExtractInput): ComponentInfo | null {
  if (input.node.type === "FunctionDeclaration") return fromFunctionDeclaration(input);
  if (input.node.type === "VariableDeclaration") return fromVariableDeclaration(input);
  return null;
}

function recordImports(node: AstNode, imports: Map<string, string>): void {
  const sourceNode = node.source as AstNode | undefined;
  const specifiers = node.specifiers as AstNode[] | undefined;
  if (!sourceNode || typeof sourceNode.value !== "string" || !specifiers) return;
  for (const spec of specifiers) {
    const local = spec.local as AstNode | undefined;
    if (local?.type === "Identifier" && typeof local.name === "string") {
      imports.set(local.name, sourceNode.value);
    }
  }
}

function unwrapExport(node: AstNode): AstNode {
  if (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration") {
    const decl = node.declaration as AstNode | undefined;
    return decl ?? node;
  }
  return node;
}

export async function parseFile(file: string): Promise<FileInfo | null> {
  const source = await readFile(file, "utf8");
  let parsed;
  try {
    parsed = parseSync(file, source, { lang: "tsx" });
  } catch {
    return null;
  }
  const bodyNodes = toAstNodes(parsed.program.body);
  const imports = new Map<string, string>();
  const components = new Map<string, ComponentInfo>();
  for (const node of bodyNodes) {
    if (node.type === "ImportDeclaration") {
      recordImports(node, imports);
      continue;
    }
    const target = unwrapExport(node);
    const info = extractComponentFromDeclaration({ file, source, node: target });
    if (info) components.set(info.name, info);
  }
  return { file, imports, components };
}
