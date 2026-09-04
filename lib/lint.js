#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TYPE_TO_ID = {
  adrs: 'adr-policy',
  bdrs: 'bdr-policy',
  edrs: 'edr-policy'
};

const ALLOWED_SUBJECTS = {
  adrs: new Set(['principles', 'application', 'data', 'platform', 'operations', 'governance']),
  bdrs: new Set(['principles', 'product', 'operations', 'governance', 'finance']),
  edrs: new Set(['principles', 'application', 'data', 'platform', 'operations', 'governance'])
};

const TYPE_NAMES = new Set(Object.keys(TYPE_TO_ID));
const RESERVED_SCOPES = new Set(['_core', '_local']);
const NUMBERED_FILE_RE = /^(\d{3,})-([a-z0-9-]+)\.md$/;
const NUMBERED_DIR_RE = /^(\d{3,})-([a-z0-9-]+)$/;
const REQUIRED_ROOT_INDEX_TEXT = 'XDRS scopes listed last override the ones listed first';
const SUBJECT_ARTIFACT_DIRS = new Set(['skills', 'articles', 'researches', 'initiatives']);
const RESOURCE_DIR_NAME = '.assets';
const SKILL_PACKAGE_OPTIONAL_DIRS = new Set(['scripts', 'references', RESOURCE_DIR_NAME]);

const POLICY_ALLOWED_FRONTMATTER_KEYS = new Set(['name', 'description', 'apply-to', 'valid-from', 'license', 'metadata', 'freeze-reference']);
const SKILL_ALLOWED_FRONTMATTER_KEYS = new Set(['name', 'description', 'license', 'metadata', 'compatibility', 'allowed-tools']);
const SCOPE_INDEX_ALLOWED_FRONTMATTER_KEYS = new Set(['scope-type', 'name', 'description', 'apply-to', 'valid-from', 'license', 'metadata', 'follows', 'extends']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);
const SLIDE_FILE_RE = /^.+-slides(?:-[a-z0-9-]+)?\.md$/;
const SLIDE_MAX_NAME_LENGTH = 64;
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const POLICY_MAX_WORDS = 2600;
const ARTICLE_MAX_WORDS = 8000;
const RESEARCH_MAX_WORDS = 5000;
const SKILL_MAX_WORDS = 6500;

// Subject number block ranges per _core-adr-policy-017
const SUBJECT_NUMBER_RANGES = {
  principles:  [1, 100],
  application: [101, 200],
  data:        [201, 300],
  platform:    [301, 400],
  operations:  [401, 500],
  governance:  [501, 600],
  product:     [601, 700],
  finance:     [701, 800],
};
const RESERVED_NUMBER_RANGE_MIN = 801;
const RESERVED_NUMBER_RANGE_MAX = 900;
const OVERFLOW_RANGE_MIN = 901;

const NORMATIVE_KEYWORDS_RE = /\bMUST NOT\b|\bMUST\b|\bSHOULD NOT\b|\bSHOULD\b|\bMAY\b|\bREQUIRED\b|\bOPTIONAL\b/;
const NORMATIVE_EMPHASIS_RE = /(\*{1,2}|_{1,2})(MUST NOT|SHOULD NOT|MUST|SHOULD|MAY|REQUIRED|OPTIONAL|always|never|mandatory|recommended|advised|preferably|possibly|optionally)(\*{1,2}|_{1,2})/i;

const RESEARCH_SECTION_LIMITS = {
  '## Abstract': 200,
  '## Introduction': 700,
  '## Methods': 1200,
  '## Results': 1800,
  '## Discussion': 1000,
  '## Conclusion': 400,
};

const DOC_TYPE_POLICY_REF = {
  Policy: '[_core-adr-policy-002]',
  Skill: '[_core-adr-policy-003]',
  Article: '[_core-adr-policy-004]',
  Research: '[_core-adr-policy-006]',
  Initiative: '[_core-adr-policy-007]',
  Slide: '[_core-adr-policy-009]',
};

function runLintCli(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const all = args.includes('--all');
  const pathArgs = args.filter((a) => !a.startsWith('--'));
  const targetPath = pathArgs[0] || '.';
  const result = lintWorkspace(targetPath, { ignoreExternal: !all });

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      console.warn(`- [warning] ${warning}`);
    }
  }

  if (result.errors.length === 0) {
    console.log(`Lint passed for ${toDisplayPath(result.xdrsRoot)}`);
    if (result.readOnlyScopes.size > 0) {
      for (const scopeName of result.readOnlyScopes) {
        console.log(`- READ-ONLY scope "${scopeName}": one or more follows -core scopes are not present in this workspace; no changes must be made to this scope [_core-adr-policy-011.08-unavailable-core-read-only]`);
      }
    }
    return 0;
  }

  console.error(`Lint failed for ${toDisplayPath(result.xdrsRoot)}`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  return 1;
}

function printHelp() {
  console.log('Usage: xdrs-core lint [options] [path]\n');
  console.log('Lint the XDRS tree rooted at [path] when [path] contains an index.md, or at [path]/.xdrs by default.');
  console.log('\nOptions:');
  console.log('  --all    Check all files, including files from external scopes distributed via .filedist.lock (default: skip external scopes)');
  console.log('\nAll other commands continue to be delegated to the bundled filedist CLI.');
}

function resolveXdrsRoot(resolvedTarget) {
  // If the path itself contains an index.md, treat it as the XDRS root directly.
  // This allows any folder name to serve as the root, not only ".xdrs".
  if (existsFile(path.join(resolvedTarget, 'index.md'))) {
    return resolvedTarget;
  }
  // Default: look for a ".xdrs" subdirectory
  return path.join(resolvedTarget, '.xdrs');
}

function lintWorkspace(targetPath, options = {}) {
  const { ignoreExternal = true } = options;
  const resolvedTarget = path.resolve(targetPath);
  const xdrsRoot = resolveXdrsRoot(resolvedTarget);
  const errors = [];
  const warnings = [];
  const readOnlyScopes = new Set();

  if (!existsDirectory(xdrsRoot)) {
    errors.push(`Missing XDRS root directory: ${toDisplayPath(xdrsRoot)} [_core-adr-policy-001]`);
    return { xdrsRoot, errors, warnings, readOnlyScopes };
  }

  const repoRoot = path.dirname(xdrsRoot);
  const filedistPaths = loadFiledist(repoRoot);
  const externalScopes = getExternalScopes(filedistPaths, xdrsRoot);
  const effectiveExternalScopes = ignoreExternal ? externalScopes : new Set();

  const actualTypeIndexes = [];
  const rootEntries = safeReadDir(xdrsRoot, errors, 'read XDRS root directory');
  const scopeEntries = rootEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));

  // Pass 1: collect known scope-type names from NNN-{scope-type}-scope-type.md files in any scope
  const knownScopeTypes = new Map(); // scopeTypeName -> filePath (first primary found, for downstream validation)
  const scopeTypePrimaryKeys = new Set(); // "scopeName|typeName|scopeTypeName" for companion co-location checks
  const scopeTypePrimaryByScope = new Map(); // "scopeName|scopeTypeName" -> [typeName, ...] for duplicate detection
  const scopeTypeCompanions = []; // [{scopeTypeName, scopeName, typeName, filePath}]
  for (const scopeEntry of scopeEntries) {
    const scopeName = scopeEntry.name;
    const scopePath = path.join(xdrsRoot, scopeName);
    for (const typeName of Object.keys(TYPE_TO_ID)) {
      const principlesDir = path.join(scopePath, typeName, 'principles');
      if (!existsDirectory(principlesDir)) continue;
      let principlesEntries;
      try { principlesEntries = fs.readdirSync(principlesDir, { withFileTypes: true }); } catch { continue; }
      for (const entry of principlesEntries) {
        if (!entry.isFile()) continue;
        const m = entry.name.match(NUMBERED_FILE_RE);
        if (!m) continue;
        const shortTitle = m[2];
        const filePath = path.join(principlesDir, entry.name);
        if (shortTitle.endsWith('-scope-type')) {
          // Primary scope-type definition file
          const rawScopeTypeName = shortTitle.slice(0, -'-scope-type'.length);
          // Special-case: 'local' maps to '_local' (underscore not allowed in NUMBERED_FILE_RE)
          const scopeTypeName = rawScopeTypeName === 'local' ? '_local' : rawScopeTypeName;
          if (!knownScopeTypes.has(scopeTypeName)) {
            knownScopeTypes.set(scopeTypeName, filePath);
          }
          scopeTypePrimaryKeys.add(`${scopeName}|${typeName}|${scopeTypeName}`);
          const scopeKey = `${scopeName}|${scopeTypeName}`;
          if (!scopeTypePrimaryByScope.has(scopeKey)) {
            scopeTypePrimaryByScope.set(scopeKey, []);
          }
          scopeTypePrimaryByScope.get(scopeKey).push(typeName);
          validateStructuredFormat(filePath, errors, '_core-adr-policy-010.08b-def-scope-type-must-be-structured');
        } else {
          // Check if it's a companion file: title contains '-scope-type-' followed by a qualifier
          const stIdx = shortTitle.indexOf('-scope-type-');
          if (stIdx > 0) {
            const rawScopeTypeName = shortTitle.slice(0, stIdx);
            // Special-case: 'local' maps to '_local'
            const scopeTypeName = rawScopeTypeName === 'local' ? '_local' : rawScopeTypeName;
            scopeTypeCompanions.push({ scopeTypeName, scopeName, typeName, filePath });
            validateStructuredFormat(filePath, errors, '_core-adr-policy-010.08b-def-scope-type-must-be-structured');
          }
        }
      }
    }
  }

  // Validate: no duplicate primaries across type folders in the same scope
  for (const [scopeKey, typeNames] of scopeTypePrimaryByScope) {
    if (typeNames.length > 1) {
      const pipeIdx = scopeKey.indexOf('|');
      const sName = scopeKey.slice(0, pipeIdx);
      const stName = scopeKey.slice(pipeIdx + 1);
      errors.push(`Scope type "${stName}" has primary definitions in multiple type folders [${typeNames.join(', ')}] in scope "${sName}": only one primary is allowed per scope [_core-adr-policy-010.02-def-naming]`);
    }
  }

  // Validate: each companion must have a corresponding primary in the same scope and type folder
  for (const { scopeTypeName, scopeName, typeName, filePath } of scopeTypeCompanions) {
    if (!scopeTypePrimaryKeys.has(`${scopeName}|${typeName}|${scopeTypeName}`)) {
      errors.push(`Companion scope-type file has no corresponding primary "${scopeTypeName}-scope-type" policy in the same scope "${scopeName}" and type folder "${typeName}": ${toDisplayPath(filePath)} [_core-adr-policy-010.02b-companion-requires-primary]`);
    }
  }

  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name !== 'index.md') {
      errors.push(`Unexpected file at .xdrs root: ${entry.name} [_core-adr-policy-001]`);
    }
  }

  // Populated during lintScopeIndexFrontmatter: scopeName -> [extendedScopeNames...]
  const extendsRelationships = new Map();

  for (const scopeEntry of scopeEntries) {
    lintScopeDirectory(xdrsRoot, scopeEntry.name, errors, warnings, actualTypeIndexes, ignoreExternal, effectiveExternalScopes, knownScopeTypes, readOnlyScopes, extendsRelationships);
  }

  // Detect cycles in extends: chains (DFS)
  const visitedCycle = new Set();
  const inStackCycle = new Set();
  const detectExtendsCycles = (scope, stack) => {
    if (inStackCycle.has(scope)) {
      const cycleStart = stack.indexOf(scope);
      const cycle = stack.slice(cycleStart).concat(scope).join(' -> ');
      errors.push(`Circular extends chain detected: ${cycle} [_core-adr-policy-010.31-extends-no-cycle]`);
      return;
    }
    if (visitedCycle.has(scope)) return;
    visitedCycle.add(scope);
    inStackCycle.add(scope);
    stack.push(scope);
    for (const target of (extendsRelationships.get(scope) || [])) {
      detectExtendsCycles(target, stack);
    }
    stack.pop();
    inStackCycle.delete(scope);
  };
  for (const scope of extendsRelationships.keys()) {
    detectExtendsCycles(scope, []);
  }

  const rootIndexPath = path.join(xdrsRoot, 'index.md');
  if (!existsFile(rootIndexPath)) {
    errors.push('Missing required root index: .xdrs/index.md [_core-adr-policy-001]');
  } else {
    lintRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors, warnings, effectiveExternalScopes, extendsRelationships);
  }

  return { xdrsRoot, errors, warnings, readOnlyScopes };
}

function lintRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors, warnings = [], externalScopes = new Set(), extendsRelationships = new Map()) {
  const content = fs.readFileSync(rootIndexPath, 'utf8');
  const repoRoot = path.dirname(xdrsRoot);

  if (!content.includes(REQUIRED_ROOT_INDEX_TEXT)) {
    errors.push(`Root index is missing required override text: ${toDisplayPath(rootIndexPath)} [_core-adr-policy-001]`);
  }

  const links = parseLocalLinks(content, path.dirname(rootIndexPath), repoRoot);
  for (const linkPath of links) {
    if (!fs.existsSync(linkPath)) {
      if (isExternalScopeLink(linkPath, xdrsRoot, externalScopes)) continue;
      errors.push(`Broken link in root index: ${displayPath(rootIndexPath, linkPath)} [_core-adr-policy-001]`);
    }
    if (isCanonicalTypeIndex(linkPath, xdrsRoot)) {
      errors.push(`Root index must not link directly to type indexes: ${displayPath(rootIndexPath, linkPath)} [_core-adr-policy-001]`);
    }
  }

  const linkedScopeIndexes = links.filter((linkPath) => isScopeIndex(linkPath, xdrsRoot));
  const linkedSet = new Set(linkedScopeIndexes.map(normalizePath));
  const localScopePath = normalizePath(path.join(xdrsRoot, '_local'));

  for (const linkPath of links) {
    if (isPathInside(localScopePath, linkPath) || normalizePath(linkPath) === localScopePath) {
      errors.push(`Root index must not link into _local scope: ${displayPath(rootIndexPath, linkPath)} [_core-adr-policy-001]`);
    }
  }

  // Build set of all scopes referenced via any extends: chain
  const extendsReferencedScopes = new Set();
  for (const entries of extendsRelationships.values()) {
    for (const e of entries) extendsReferencedScopes.add(e);
  }

  // Collect non-_local scopes that have type indexes and check their scope index is linked
  const scopesWithTypeIndexes = new Set();
  for (const indexPath of actualTypeIndexes) {
    const scopeName = path.basename(path.dirname(path.dirname(indexPath)));
    if (scopeName !== '_local') {
      scopesWithTypeIndexes.add(scopeName);
    }
  }

  for (const scopeName of scopesWithTypeIndexes) {
    const scopeIndexPath = normalizePath(path.join(xdrsRoot, scopeName, 'index.md'));
    if (!linkedSet.has(scopeIndexPath)) {
      // Exempt scopes that are only reachable via extends: chains
      if (extendsReferencedScopes.has(scopeName)) {
        // Scope is extends-only (not in root index) — exempt from mandatory link requirement
        // No warning here: absence from root index is expected and valid for extends-only scopes
        continue;
      }
      errors.push(`Root index is missing scope index link: ${toDisplayPath(path.join(xdrsRoot, scopeName, 'index.md'))} [_core-adr-policy-001]`);
    } else if (extendsReferencedScopes.has(scopeName)) {
      // Scope is in BOTH root index and extends chain — ambiguous dual precedence
      warnings.push(`Scope "${scopeName}" appears in both the root index and an extends: chain; precedence may be ambiguous for consumers that do not follow extends declarations: ${toDisplayPath(path.join(xdrsRoot, scopeName, 'index.md'))} [_core-adr-policy-010.35-extends-index]`);
    }
  }
}

function lintScopeIndex(scopeIndexPath, xdrsRoot, scopeName, typeIndexesInScope, errors, externalScopes = new Set()) {
  const content = fs.readFileSync(scopeIndexPath, 'utf8');
  const repoRoot = path.dirname(xdrsRoot);
  const links = parseLocalLinks(content, path.dirname(scopeIndexPath), repoRoot);
  const linkedSet = new Set(links.map(normalizePath));

  for (const linkPath of links) {
    if (!fs.existsSync(linkPath)) {
      if (isExternalScopeLink(linkPath, xdrsRoot, externalScopes)) continue;
      errors.push(`Broken link in scope index: ${displayPath(scopeIndexPath, linkPath)} [_core-adr-policy-001]`);
    }
  }

  for (const typeIndexPath of typeIndexesInScope) {
    if (!linkedSet.has(normalizePath(typeIndexPath))) {
      errors.push(`Scope index ${toDisplayPath(scopeIndexPath)} is missing link to type index: ${toDisplayPath(typeIndexPath)} [_core-adr-policy-001]`);
    }
  }
}

/**
 * Parse a scope-type policy file for a NN-parent-scope-type rule and return the parent type name.
 * Returns null if no parent is declared or the file cannot be read.
 */
function extractParentScopeType(policyFilePath) {
  let content;
  try { content = fs.readFileSync(policyFilePath, 'utf8'); } catch { return null; }
  // Find a rule heading like "#### NN-parent-scope-type"
  const headingMatch = content.match(/^#{4}\s+\d+-parent-scope-type\s*$/m);
  if (!headingMatch) return null;
  // Extract text after the heading until the next heading or end of file
  const afterHeading = content.slice(content.indexOf(headingMatch[0]) + headingMatch[0].length);
  const bodyMatch = afterHeading.match(/`([a-z0-9-]+)`/);
  return bodyMatch ? bodyMatch[1] : null;
}

function lintScopeIndexFrontmatter(scopeIndexPath, scopeName, errors, xdrsRoot, knownScopeTypes = new Map(), readOnlyScopes = new Set(), extendsRelationships = new Map()) {
  const content = fs.readFileSync(scopeIndexPath, 'utf8');
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!fmMatch) {
    errors.push(`Scope index must start with a YAML frontmatter block: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
    return;
  }
  const block = fmMatch[1];
  const fm = extractFrontmatter(content);

  for (const key of fm.topLevelKeys) {
    if (!SCOPE_INDEX_ALLOWED_FRONTMATTER_KEYS.has(key)) {
      errors.push(`Scope index frontmatter has unknown field "${key}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
    }
  }

  const scopeTypeMatch = block.match(/^scope-type:\s*(.+)$/m);
  const scopeTypeRaw = scopeTypeMatch ? scopeTypeMatch[1].trim() : null;
  if (!scopeTypeRaw) {
    errors.push(`Scope index frontmatter must include a scope-type field: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.08-def-valid-iff-policy-exists]`);
    return;
  }

  // Parse scope-type: supports single string or comma-separated list (e.g. "compiled, internal-docs")
  const commaSeparatedScopeTypePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_-]*)+$/;
  let scopeTypes;
  if (commaSeparatedScopeTypePattern.test(scopeTypeRaw)) {
    scopeTypes = scopeTypeRaw.split(',').map((s) => s.trim());
  } else {
    scopeTypes = [scopeTypeRaw];
  }

  // Validate each element: no duplicates, valid chars, no reserved prefix
  const seenTypes = new Set();
  let hasElementError = false;
  const SCOPE_TYPE_ELEMENT_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  for (const scopeType of scopeTypes) {
    if (!SCOPE_TYPE_ELEMENT_RE.test(scopeType)) {
      errors.push(`Scope type element "${scopeType}" contains invalid characters (must match [a-zA-Z_][a-zA-Z0-9_-]*): ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.06-def-no-underscore-prefix]`);
      hasElementError = true;
      continue;
    }
    if (scopeType.startsWith('_') && scopeType !== '_local') {
      errors.push(`Scope type "${scopeType}" uses a reserved "_" prefix; only "_local" is a valid underscore-prefixed scope type: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.06-def-no-underscore-prefix]`);
      hasElementError = true;
      continue;
    }
    if (seenTypes.has(scopeType)) {
      errors.push(`Scope type list contains duplicate value "${scopeType}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.05b-def-multi-type-validation]`);
      hasElementError = true;
      continue;
    }
    seenTypes.add(scopeType);
  }
  if (hasElementError) return;

  // Use first element for single-value checks that only apply to the primary type
  const scopeType = scopeTypes[0];

  // Validate each type exists in knownScopeTypes and check parent chains with global cycle detection
  const globalVisited = new Set(scopeTypes);
  for (const st of scopeTypes) {
    if (st === '_local') continue;
    if (!knownScopeTypes.has(st)) {
      errors.push(`Scope index scope-type "${st}" has no corresponding ${st}-scope-type policy in the principles of any scope: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.08-def-valid-iff-policy-exists]`);
      continue;
    }
    // Validate parent chain
    let currentType = st;
    while (currentType) {
      const policyPath = knownScopeTypes.get(currentType);
      if (!policyPath) break;
      const parentType = extractParentScopeType(policyPath);
      if (!parentType) break;
      if (globalVisited.has(parentType)) {
        errors.push(`Scope type "${currentType}" declares parent "${parentType}" which creates a cycle in the scope-type inheritance chain: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.07-def-parent-scope-type]`);
        break;
      }
      if (!knownScopeTypes.has(parentType)) {
        errors.push(`Scope type "${currentType}" declares parent "${parentType}" but no ${parentType}-scope-type policy exists in any scope: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.07-def-parent-scope-type]`);
        break;
      }
      globalVisited.add(parentType);
      currentType = parentType;
    }
  }
  if (scopeName === '_core' && scopeType !== 'core') {
    errors.push(`Scope "_core" must have scope-type "core": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-011.01-scope-type-name]`);
  }
  if (scopeName === '_local' && scopeType !== '_local') {
    errors.push(`Scope "_local" must have scope-type "_local": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-015.01-scope-type-name]`);
  }
  if (scopeTypes.includes('core') && !scopeName.includes('core')) {
    errors.push(`Scope with type "core" must have "core" in its name: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-011.03-naming-convention]`);
  }
  if (scopeTypes.includes('_local') && scopeName !== '_local') {
    errors.push(`Scope type "_local" is reserved for the "_local" scope: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-015.03-exclusive-reservation]`);
  }
  if (scopeTypes.includes('reference') && !scopeName.includes('-ref-')) {
    errors.push(`Scope with type "reference" must follow the naming pattern {domain}-ref-{name} (e.g. "security-ref-baseline"): ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-012.03-naming-convention]`);
  }
  if (scopeTypes.includes('platform') && !scopeName.includes('-plat-')) {
    errors.push(`Scope with type "platform" must follow the naming pattern {domain}-plat-{name} (e.g. "cloud-plat-aws"): ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-013.03-naming-convention]`);
  }

  if (!fm.name) {
    errors.push(`Scope index frontmatter must include a non-empty name field: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  } else if (fm.name !== scopeName) {
    errors.push(`Scope index frontmatter name must match scope directory name "${scopeName}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  }

  if (!fm.description) {
    errors.push(`Scope index frontmatter must include a non-empty description field: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  } else if (fm.descriptionText && countWords(fm.descriptionText) > 40) {
    errors.push(`Scope index frontmatter description must be 40 words or fewer: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  }

  if (!fm.appliedTo) {
    errors.push(`Scope index frontmatter must include an apply-to field: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  } else {
    const words = countWords(fm.appliedTo);
    if (words === 0) {
      errors.push(`Scope index frontmatter apply-to must not be empty: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
    } else if (words > 30) {
      errors.push(`Scope index frontmatter apply-to must be 30 words or fewer: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
    }
  }

  if (!fm.validFrom) {
    errors.push(`Scope index frontmatter must include a valid-from field: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  } else if (!isIsoDate(fm.validFrom)) {
    errors.push(`Scope index frontmatter valid-from must be a valid ISO date YYYY-MM-DD: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  }

  let followsEntries = [];
  const followsLineMatch = block.match(/^follows:[ \t]*(.*)/m);
  if (followsLineMatch !== null) {
    const followsValue = followsLineMatch[1].trim();
    const scopeNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    const commaSeparatedPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*(\s*,\s*[a-zA-Z_][a-zA-Z0-9_-]*)+$/;
    if (followsValue) {
      if (!scopeNamePattern.test(followsValue) && !commaSeparatedPattern.test(followsValue)) {
        errors.push(`Scope index frontmatter follows must be a core scope name or list of core scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
      }
    } else {
      const followsStart = block.indexOf(followsLineMatch[0]) + followsLineMatch[0].length;
      const listItems = [];
      let hasInvalidEntry = false;
      for (const line of block.slice(followsStart).split('\n')) {
        const itemMatch = line.match(/^\s+-\s*(\S.*)?$/);
        if (itemMatch) {
          const item = (itemMatch[1] || '').trim();
          if (!item || !scopeNamePattern.test(item)) {
            errors.push(`Scope index frontmatter follows entries must be non-empty scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
            hasInvalidEntry = true;
            break;
          }
          listItems.push(item);
        } else if (line.trim() && !/^\s/.test(line)) {
          break;
        }
      }
      if (!hasInvalidEntry && listItems.length === 0) {
        errors.push(`Scope index frontmatter follows must be a core scope name or list of core scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
      }
    }
    if (xdrsRoot) {
      const entries = followsValue
        ? (commaSeparatedPattern.test(followsValue)
            ? followsValue.split(',').map((s) => s.trim())
            : [followsValue])
        : (() => {
          const items = [];
          const followsStart = block.indexOf(followsLineMatch[0]) + followsLineMatch[0].length;
          for (const line of block.slice(followsStart).split('\n')) {
            const itemMatch = line.match(/^\s+-\s*(\S.*)?$/);
            if (itemMatch && itemMatch[1]) items.push(itemMatch[1].trim());
            else if (line.trim() && !/^\s/.test(line)) break;
          }
          return items;
        })();
      followsEntries = entries;
      const seenFollows = new Set();
      for (const entry of entries) {
        if (seenFollows.has(entry)) {
          errors.push(`Scope index frontmatter follows has duplicate entry "${entry}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
        }
        seenFollows.add(entry);
        if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(entry)) {
          if (entry === scopeName) {
            errors.push(`Scope index frontmatter follows must not reference the scope itself: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
            continue;
          }
          if (entry === '_core') {
            errors.push(`Scope index frontmatter follows must not reference "_core" as it is always applied implicitly: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
            continue;
          }
          const followedIndexPath = path.join(xdrsRoot, entry, 'index.md');
          if (!existsFile(followedIndexPath)) {
            errors.push(`Scope index frontmatter follows references scope "${entry}" which does not exist in the workspace: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
          } else {
            const followedContent = fs.readFileSync(followedIndexPath, 'utf8');
            const followedTypeMatch = followedContent.match(/^scope-type:\s*(.+)$/m);
            if (!followedTypeMatch || followedTypeMatch[1].trim() !== 'core') {
              errors.push(`Scope index frontmatter follows references scope "${entry}" which is not a core-type scope: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
            }
          }
        }
      }
    }
  }

  // Parse extends: field
  let extendsEntries = [];
  const extendsLineMatch = block.match(/^extends:[ \t]*(.*)/m);
  if (extendsLineMatch !== null) {
    const extendsValue = extendsLineMatch[1].trim();
    const scopeNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    const commaSeparatedPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_-]*)+$/;
    if (extendsValue) {
      if (!scopeNamePattern.test(extendsValue) && !commaSeparatedPattern.test(extendsValue)) {
        errors.push(`Scope index frontmatter extends must be a scope name or list of scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.27-extends-declaration]`);
      }
    } else {
      const extendsStart = block.indexOf(extendsLineMatch[0]) + extendsLineMatch[0].length;
      const listItems = [];
      let hasInvalidEntry = false;
      for (const line of block.slice(extendsStart).split('\n')) {
        const itemMatch = line.match(/^\s+-\s*(\S.*)?$/);
        if (itemMatch) {
          const item = (itemMatch[1] || '').trim();
          if (!item || !scopeNamePattern.test(item)) {
            errors.push(`Scope index frontmatter extends entries must be non-empty scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.27-extends-declaration]`);
            hasInvalidEntry = true;
            break;
          }
          listItems.push(item);
        } else if (line.trim() && !/^\s/.test(line)) {
          break;
        }
      }
      if (!hasInvalidEntry && listItems.length === 0) {
        errors.push(`Scope index frontmatter extends must be a scope name or list of scope names: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.27-extends-declaration]`);
      }
    }
    const rawEntries = extendsValue
      ? (commaSeparatedPattern.test(extendsValue)
          ? extendsValue.split(',').map((s) => s.trim())
          : (scopeNamePattern.test(extendsValue) ? [extendsValue] : []))
      : (() => {
        const items = [];
        const extendsStart = block.indexOf(extendsLineMatch[0]) + extendsLineMatch[0].length;
        for (const line of block.slice(extendsStart).split('\n')) {
          const itemMatch = line.match(/^\s+-\s*(\S.*)?$/);
          if (itemMatch && itemMatch[1]) items.push(itemMatch[1].trim());
          else if (line.trim() && !/^\s/.test(line)) break;
        }
        return items;
      })();
    const seenExtends = new Set();
    for (const entry of rawEntries) {
      if (seenExtends.has(entry)) {
        errors.push(`Scope index frontmatter extends has duplicate entry "${entry}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.27-extends-declaration]`);
        continue;
      }
      seenExtends.add(entry);
      if (!scopeNamePattern.test(entry)) continue;
      if (entry === scopeName) {
        errors.push(`Scope index frontmatter extends must not reference the scope itself: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.30-extends-no-self]`);
        continue;
      }
      if (entry === '_local' || entry === '_core') {
        errors.push(`Scope index frontmatter extends must not reference reserved scope "${entry}": ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.29-extends-reserved-scopes]`);
        continue;
      }
      extendsEntries.push(entry);
    }
    if (xdrsRoot) {
      const seenValid = new Set();
      for (const entry of extendsEntries) {
        if (seenValid.has(entry)) continue;
        seenValid.add(entry);
        if (followsEntries.includes(entry)) {
          errors.push(`Scope index frontmatter extends must not repeat scope "${entry}" already declared in follows: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.28-extends-disjoint]`);
          continue;
        }
        if (!existsFile(path.join(xdrsRoot, entry, 'index.md'))) {
          errors.push(`Scope index frontmatter extends references scope "${entry}" which does not exist in the workspace: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-010.32-extends-mandatory-presence]`);
        }
      }
      if (extendsEntries.length > 0) {
        extendsRelationships.set(scopeName, extendsEntries.filter((e) => existsFile(path.join(xdrsRoot, e, 'index.md'))));
      }
    }
  }
}


function lintScopeDirectory(xdrsRoot, scopeName, errors, warnings, actualTypeIndexes, ignoreExternal, externalScopes, knownScopeTypes = new Map(), readOnlyScopes = new Set(), extendsRelationships = new Map()) {
  const scopePath = path.join(xdrsRoot, scopeName);

  if (ignoreExternal && externalScopes.has(scopeName)) {
    return;
  }

  if (!isValidScopeName(scopeName)) {
    errors.push(`Invalid scope name: ${toDisplayPath(scopePath)} [_core-adr-policy-001]`);
  }

  // Determine if this scope is a core-type scope (but not _core which is exempt)
  // Used to enforce structured format on all policies in core-type scopes
  let isCoreTypeNonExempt = false;
  let isCompiledScope = false;
  if (scopeName !== '_core') {
    const scopeIndexPath = path.join(scopePath, 'index.md');
    if (existsFile(scopeIndexPath)) {
      try {
        const idxContent = fs.readFileSync(scopeIndexPath, 'utf8');
        const stMatch = idxContent.match(/^scope-type:\s*(.+)$/m);
        if (stMatch) {
          const stRaw = stMatch[1].trim();
          // Handle both "[type1, type2]" YAML array format and "type1, type2" inline CSV format
          const stList = stRaw.startsWith('[') && stRaw.endsWith(']')
            ? stRaw.slice(1, -1).split(',').map((s) => s.trim())
            : stRaw.split(',').map((s) => s.trim());
          isCoreTypeNonExempt = stList.includes('core');
          isCompiledScope = stList.includes('compiled');
        }
      } catch { /* ignore read errors; will be caught later */ }
    }
  }

  const typeIndexesInScope = [];
  const entries = safeReadDir(scopePath, errors, `read scope directory ${scopeName}`);
  for (const entry of entries) {
    const entryPath = path.join(scopePath, entry.name);
    if (entry.isDirectory()) {
      if (!TYPE_NAMES.has(entry.name)) {
        errors.push(`Unexpected directory under scope ${scopeName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
        continue;
      }
      lintTypeDirectory(xdrsRoot, scopeName, entry.name, errors, warnings, actualTypeIndexes, externalScopes, isCoreTypeNonExempt, isCompiledScope);
      const typeIndexPath = path.join(entryPath, 'index.md');
      if (existsFile(typeIndexPath)) {
        typeIndexesInScope.push(typeIndexPath);
      }
      continue;
    }

    if (entry.name === 'index.md') {
      continue;
    }

    errors.push(`Unexpected file under scope ${scopeName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
  }

  const scopeIndexPath = path.join(scopePath, 'index.md');
  if (!existsFile(scopeIndexPath)) {
    errors.push(`Missing required scope index: ${toDisplayPath(scopeIndexPath)} [_core-adr-policy-001]`);
  } else {
    lintScopeIndex(scopeIndexPath, xdrsRoot, scopeName, typeIndexesInScope, errors, externalScopes);
    lintScopeIndexFrontmatter(scopeIndexPath, scopeName, errors, xdrsRoot, knownScopeTypes, readOnlyScopes, extendsRelationships);
  }
  lintLocalMetaPolicies(xdrsRoot, scopeName, errors, isCompiledScope);
}

function lintLocalMetaPolicies(xdrsRoot, scopeName, errors, isCompiledScope = false) {
  const scopePath = path.join(xdrsRoot, scopeName);
  // Track qualifiers across all type folders: qualifier ('' for primary) -> filePath
  const seenQualifiers = new Map();
  for (const typeName of Object.keys(TYPE_TO_ID)) {
    const principlesDir = path.join(scopePath, typeName, 'principles');
    if (!existsDirectory(principlesDir)) continue;
    let principlesEntries;
    try { principlesEntries = fs.readdirSync(principlesDir, { withFileTypes: true }); } catch { continue; }
    // Collect primary and companions per type folder
    let primaryInFolder = null;
    const companionsInFolder = [];
    for (const entry of principlesEntries) {
      if (!entry.isFile()) continue;
      const m = entry.name.match(NUMBERED_FILE_RE);
      if (!m) continue;
      const title = m[2];
      // Exclude scope-type definition files
      if (title.endsWith('-scope-type')) continue;
      const titleParts = title.split('-');
      if (titleParts[0] !== 'core') continue;
      // Determine qualifier ('') for primary, qualifier string for companions
      const qualifier = titleParts.length === 1 ? '' : titleParts.slice(1).join('-');
      const filePath = path.join(principlesDir, entry.name);
      if (qualifier === '') {
        primaryInFolder = { filePath, qualifier };
      } else {
        companionsInFolder.push({ filePath, qualifier });
      }
    }
    // Error: companion exists without primary in same type folder
    for (const companion of companionsInFolder) {
      if (!primaryInFolder) {
        errors.push(`Local meta-policy companion "${path.basename(companion.filePath)}" requires a primary "NNN-core.md" in the same type folder "${typeName}": ${toDisplayPath(companion.filePath)} [_core-adr-policy-010.10b-local-primary-required]`);
      }
    }
    // For compiled scopes: primary meta-policy must include ## Sources and ## Selectors
    if (isCompiledScope && primaryInFolder) {
      let metaContent;
      try { metaContent = fs.readFileSync(primaryInFolder.filePath, 'utf8'); } catch { /* will be caught elsewhere */ }
      if (metaContent !== undefined) {
        const metaLines = metaContent.split(/\r?\n/);
        const metaIgnored = findIgnoredMarkdownLines(metaLines);
        if (findHeadingLine(metaLines, metaIgnored, '## Sources') === -1) {
          errors.push(`Compiled scope meta-policy must include a "## Sources" section: ${toDisplayPath(primaryInFolder.filePath)} [_core-adr-policy-019.07-compilation-meta-policy]`);
        }
        if (findHeadingLine(metaLines, metaIgnored, '## Selectors') === -1) {
          errors.push(`Compiled scope meta-policy must include a "## Selectors" section: ${toDisplayPath(primaryInFolder.filePath)} [_core-adr-policy-019.07-compilation-meta-policy]`);
        }
      }
    }
    // Check qualifier uniqueness across all type folders
    const allInFolder = primaryInFolder ? [primaryInFolder, ...companionsInFolder] : companionsInFolder;
    for (const { filePath, qualifier } of allInFolder) {
      const existing = seenQualifiers.get(qualifier);
      if (existing) {
        const label = qualifier === '' ? 'primary (no qualifier)' : `qualifier "${qualifier}"`;
        errors.push(`Local meta-policy ${label} appears in multiple type folders in scope "${scopeName}": ${toDisplayPath(existing)} and ${toDisplayPath(filePath)} [_core-adr-policy-010.10c-local-unique-qualifier]`);
      } else {
        seenQualifiers.set(qualifier, filePath);
      }
      // Validate structured format for all local meta-policy files
      validateStructuredFormat(filePath, errors, '_core-adr-policy-010.12b-local-must-be-structured');
    }
  }
}

function lintTypeDirectory(xdrsRoot, scopeName, typeName, errors, warnings, actualTypeIndexes, externalScopes = new Set(), enforceStructured = false, isCompiledScope = false) {
  const typePath = path.join(xdrsRoot, scopeName, typeName);
  const indexPath = path.join(typePath, 'index.md');
  const xdrsNumbers = new Map();
  const artifacts = [];

  if (!existsFile(indexPath)) {
    errors.push(`Missing canonical index: ${toDisplayPath(indexPath)} [_core-adr-policy-001]`);
  } else {
    actualTypeIndexes.push(indexPath);
  }

  const entries = safeReadDir(typePath, errors, `read type directory ${scopeName}/${typeName}`);
  for (const entry of entries) {
    const entryPath = path.join(typePath, entry.name);
    if (entry.isFile()) {
      if (entry.name !== 'index.md') {
        errors.push(`Unexpected file under ${scopeName}/${typeName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
      }
      continue;
    }

    if (!ALLOWED_SUBJECTS[typeName].has(entry.name)) {
      if (hasAnyNonFrozenPolicy(entryPath)) {
        errors.push(`Invalid subject folder for ${typeName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
        continue;
      }
      // All policies are frozen: emit a warning and still process for content-level checks.
      warnings.push(`Invalid subject folder for ${typeName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001] [exempt: freeze-reference]`);
    }

    artifacts.push(...lintSubjectDirectory(xdrsRoot, scopeName, typeName, entry.name, xdrsNumbers, errors, warnings, externalScopes, enforceStructured, isCompiledScope));
  }

  if (existsFile(indexPath)) {
    lintTypeIndex(indexPath, xdrsRoot, artifacts, errors, externalScopes);
  }
}

function lintSubjectDirectory(xdrsRoot, scopeName, typeName, subjectName, xdrsNumbers, errors, warnings, externalScopes = new Set(), enforceStructured = false, isCompiledScope = false) {
  const subjectPath = path.join(xdrsRoot, scopeName, typeName, subjectName);
  const artifacts = [];
  const entries = safeReadDir(subjectPath, errors, `read subject directory ${scopeName}/${typeName}/${subjectName}`);

  for (const entry of entries) {
    const entryPath = path.join(subjectPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === RESOURCE_DIR_NAME) {
        continue;
      }
      if (entry.name === 'skills') {
        artifacts.push(...lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, externalScopes));
        continue;
      }
      if (entry.name === 'articles') {
        artifacts.push(...lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, externalScopes));
        continue;
      }
      if (entry.name === 'researches') {
        artifacts.push(...lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, externalScopes));
        continue;
      }
      if (entry.name === 'initiatives') {
        artifacts.push(...lintInitiativesDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, externalScopes));
        continue;
      }

      errors.push(`Unexpected directory under ${scopeName}/${typeName}/${subjectName}: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
      continue;
    }

    if (!NUMBERED_FILE_RE.test(entry.name)) {
      errors.push(`Invalid Policy file name: ${toDisplayPath(entryPath)} [_core-adr-policy-001]`);
      continue;
    }

    artifacts.push(entryPath);
    lintXdrsElementFile(xdrsRoot, scopeName, typeName, subjectName, entryPath, xdrsNumbers, errors, warnings, externalScopes, enforceStructured, isCompiledScope);
  }

  const subjectAssetsDir = path.join(subjectPath, RESOURCE_DIR_NAME);
  const xdrsDocsInSubject = artifacts.filter((p) => path.dirname(p) === subjectPath);
  lintOrphanAssets(subjectAssetsDir, xdrsDocsInSubject, xdrsRoot, errors);

  return artifacts;
}

function lintXdrsElementFile(xdrsRoot, scopeName, typeName, subjectName, filePath, xdrsNumbers, errors, warnings, externalScopes = new Set(), enforceStructured = false, isCompiledScope = false) {
  const baseName = path.basename(filePath);
  const match = baseName.match(NUMBERED_FILE_RE);
  if (!match) {
    return;
  }

  const number = match[1];
  const previous = xdrsNumbers.get(number);
  if (previous) {
    errors.push(`Duplicate Policy number ${number} in ${scopeName}/${typeName}: ${toDisplayPath(previous)} and ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else {
    xdrsNumbers.set(number, filePath);
  }

  if (baseName !== baseName.toLowerCase()) {
    errors.push(`Policy file name must be lowercase: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  lintPolicyNumberRange(number, subjectName, content, filePath, errors, warnings);
  const { freezeReference } = extractFrontmatter(content);
  const expectedHeader = `# ${scopeName}-${TYPE_TO_ID[typeName]}-${number}:`;
  const firstLine = firstNonEmptyLine(stripFrontmatter(content));
  if (!freezeReference && !firstLine.startsWith(expectedHeader)) {
    errors.push(`Policy title must start with "${expectedHeader}": ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else if (freezeReference && !firstLine.startsWith(expectedHeader)) {
    warnings.push(`Policy title must start with "${expectedHeader}": ${toDisplayPath(filePath)} [_core-adr-policy-002] [exempt: freeze-reference]`);
  }

  // Enforce 'core' word reservation: only allowed as first word of filename title in principles/
  const titleParts = match[2].split('-');
  if (titleParts.includes('core') && !(subjectName === 'principles' && titleParts[0] === 'core')) {
    const msg = `Policy filename must not use "core" as a name word unless it is a local meta-policy in "principles/" starting with "core" (e.g., "NNN-core.md" or "NNN-core-{qualifier}.md"): ${toDisplayPath(filePath)} [_core-adr-policy-010.09-local-naming]`;
    if (freezeReference) { warnings.push(`${msg} [exempt: freeze-reference]`); } else { errors.push(msg); }
  }

  const expectedName = extractExpectedXdrsNameFromHeading(firstLine)
    || `${scopeName}-${TYPE_TO_ID[typeName]}-${number}-${match[2]}`;
  lintXdrsElementFrontmatter(content, expectedName, filePath, errors, warnings, freezeReference);
  if (enforceStructured) {
    validateStructuredFormatContent(content, filePath, errors, '_core-adr-policy-010.08c-def-core-scope-policies-must-be-structured');
  } else if (isCompiledScope) {
    validateStructuredFormatContent(content, filePath, errors, '_core-adr-policy-019.04-structured-format-required');
  } else {
    lintStructuredRuleBlocks(content, filePath, errors);
  }
  const isLocalMetaPolicy = subjectName === 'principles' && titleParts[0] === 'core';
  if (isCompiledScope && !isLocalMetaPolicy) {
    lintCompiledPolicySourceSection(content, filePath, errors);
  }
  lintRequiredSections(content, filePath, XDRS_REQUIRED_SECTIONS, 'Policy', errors);
  lintNoEmojis(content, filePath, 'Policy', errors);
  lintWordCount(content, filePath, 'Policy', POLICY_MAX_WORDS, errors);
  lintDocumentLinks(filePath, xdrsRoot, scopeName, errors, externalScopes);
}

function extractExpectedXdrsNameFromHeading(headingLine) {
  const match = headingLine.match(/^#\s+([a-z0-9_]+-(?:adr-policy|bdr-policy|edr-policy)-\d{3,}):\s+(.+?)\s*$/);
  if (!match) {
    return null;
  }

  const identifier = match[1];
  const titleSlug = slugifyTitle(match[2]);
  if (!titleSlug) {
    return null;
  }

  return `${identifier}-${titleSlug}`;
}

function slugifyTitle(title) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function lintXdrsElementFrontmatter(content, expectedName, filePath, errors, warnings, freezeReference = false) {
  const fm = extractFrontmatter(content);
  if (!fm.present) {
    errors.push(`Policy must start with a YAML frontmatter block: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    return;
  }
  if (!fm.name) {
    errors.push(`Policy frontmatter must include a non-empty name field: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else {
    if (fm.name !== expectedName) {
      const msg = `Policy frontmatter name must be "${expectedName}": ${toDisplayPath(filePath)} [_core-adr-policy-002]`;
      if (freezeReference) { warnings.push(`${msg} [exempt: freeze-reference]`); } else { errors.push(msg); }
    }
    if (fm.name.endsWith('-')) {
      errors.push(`Policy frontmatter name must not end with a hyphen: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    }
    if (fm.name.length > 64) {
      errors.push(`Policy frontmatter name must be 64 characters or fewer: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    }
  }
  if (!fm.description) {
    errors.push(`Policy frontmatter must include a non-empty description field: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else if (fm.descriptionText && fm.descriptionText.length > 1024) {
    errors.push(`Policy frontmatter description must be 1024 characters or fewer: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  }
  if (!fm.validFrom) {
    errors.push(`Policy frontmatter must include a valid-from field: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else if (!isIsoDate(fm.validFrom)) {
    errors.push(`Policy frontmatter valid-from must be a valid ISO date YYYY-MM-DD: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  }
  if (!fm.appliedTo) {
    errors.push(`Policy frontmatter must include an apply-to field: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
  } else {
    const words = countWords(fm.appliedTo);
    if (words === 0) {
      errors.push(`Policy frontmatter apply-to must not be empty: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    } else if (words >= 40) {
      errors.push(`Policy frontmatter apply-to must be under 40 words: ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    }
  }
  for (const key of fm.topLevelKeys) {
    if (!POLICY_ALLOWED_FRONTMATTER_KEYS.has(key)) {
      errors.push(`Policy frontmatter has unknown field "${key}": ${toDisplayPath(filePath)} [_core-adr-policy-002]`);
    }
  }
}

function lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, skillsPath, errors, externalScopes = new Set()) {
  const artifacts = [];
  const skillNumbers = new Map();
  const entries = safeReadDir(skillsPath, errors, `read skills directory ${scopeName}/${typeName}/${subjectName}/skills`);

  for (const entry of entries) {
    const entryPath = path.join(skillsPath, entry.name);
    if (!entry.isDirectory()) {
      errors.push(`Unexpected file in skills directory: ${toDisplayPath(entryPath)} [_core-adr-policy-003]`);
      continue;
    }

    // .assets is allowed as a shared resources directory within skills/
    if (entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    const match = entry.name.match(NUMBERED_DIR_RE);
    if (!match) {
      errors.push(`Invalid skill package name: ${toDisplayPath(entryPath)} [_core-adr-policy-003]`);
      continue;
    }

    const number = match[1];
    const previous = skillNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate skill number ${number} in ${scopeName}/${typeName}/${subjectName}/skills: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)} [_core-adr-policy-003]`);
    } else {
      skillNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Skill package name must be lowercase: ${toDisplayPath(entryPath)} [_core-adr-policy-003]`);
    }

    const skillFilePath = path.join(entryPath, 'SKILL.md');
    const packageEntries = safeReadDir(entryPath, errors, `read skill package ${toDisplayPath(entryPath)}`);

    for (const packageEntry of packageEntries) {
      const packageEntryPath = path.join(entryPath, packageEntry.name);

      if (!packageEntry.isDirectory()) {
        continue;
      }

      if (SKILL_PACKAGE_OPTIONAL_DIRS.has(packageEntry.name)) {
        continue;
      }

      errors.push(`Unexpected directory in skill package: ${toDisplayPath(packageEntryPath)} [_core-adr-policy-003]`);
    }

    if (!existsFile(skillFilePath)) {
      errors.push(`Missing SKILL.md in skill package: ${toDisplayPath(entryPath)} [_core-adr-policy-003]`);
      continue;
    }

    artifacts.push(skillFilePath);

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');
    lintRequiredSections(skillContent, skillFilePath, SKILL_REQUIRED_SECTIONS, 'Skill', errors);
    const skillFm = extractFrontmatter(skillContent);
    if (!skillFm.present) {
      errors.push(`SKILL.md must start with a YAML frontmatter block: ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
    } else {
      if (!skillFm.name) {
        errors.push(`SKILL.md frontmatter must include a non-empty name field: ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
      } else {
        const expectedSkillName = `${number}-${match[2]}`;
        if (skillFm.name !== expectedSkillName) {
          errors.push(`Skill frontmatter name must be "${expectedSkillName}": ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
        }
        if (skillFm.name.length > 64) {
          errors.push(`SKILL.md frontmatter name must be 64 characters or fewer: ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
        }
      }
      if (!skillFm.description) {
        errors.push(`SKILL.md frontmatter must include a non-empty description field: ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
      } else if (skillFm.descriptionText && skillFm.descriptionText.length > 1024) {
        errors.push(`SKILL.md frontmatter description must be 1024 characters or fewer: ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
      }
      for (const key of skillFm.topLevelKeys) {
        if (!SKILL_ALLOWED_FRONTMATTER_KEYS.has(key)) {
          errors.push(`SKILL.md frontmatter has unknown field "${key}": ${toDisplayPath(skillFilePath)} [_core-adr-policy-003]`);
        }
      }
    }

    lintNoEmojis(skillContent, skillFilePath, 'Skill', errors);
    lintWordCount(skillContent, skillFilePath, 'Skill', SKILL_MAX_WORDS, errors);
    lintDocumentLinks(skillFilePath, xdrsRoot, scopeName, errors, externalScopes);
    lintOrphanAssets(path.join(entryPath, RESOURCE_DIR_NAME), [skillFilePath], xdrsRoot, errors);
  }

  return artifacts;
}

function lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, articlesPath, errors, externalScopes = new Set()) {
  const artifacts = [];
  const articleNumbers = new Map();
  const entries = safeReadDir(articlesPath, errors, `read articles directory ${scopeName}/${typeName}/${subjectName}/articles`);

  for (const entry of entries) {
    const entryPath = path.join(articlesPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in articles folder: ${toDisplayPath(entryPath)} [_core-adr-policy-004]`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid article file name: ${toDisplayPath(entryPath)} [_core-adr-policy-004]`);
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = articleNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate article number ${number} in ${scopeName}/${typeName}/${subjectName}/articles: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)} [_core-adr-policy-004]`);
    } else {
      articleNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Article file name must be lowercase: ${toDisplayPath(entryPath)} [_core-adr-policy-004]`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const typeId = TYPE_TO_ID[typeName].split('-')[0]; // 'adr', 'bdr', or 'edr'
    const expectedHeader = `# ${scopeName}-${typeId}-article-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Article title must start with "${expectedHeader}": ${toDisplayPath(entryPath)} [_core-adr-policy-004]`);
    }

    lintRequiredSections(content, entryPath, ARTICLE_REQUIRED_SECTIONS, 'Article', errors);
    lintNoEmojis(content, entryPath, 'Article', errors);
    lintWordCount(content, entryPath, 'Article', ARTICLE_MAX_WORDS, errors);
    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors, externalScopes);
  }

  lintOrphanAssets(path.join(articlesPath, RESOURCE_DIR_NAME), artifacts, xdrsRoot, errors);

  return artifacts;
}

function lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, researchPath, errors, externalScopes = new Set()) {
  const artifacts = [];
  const researchNumbers = new Map();
  const entries = safeReadDir(researchPath, errors, `read research directory ${scopeName}/${typeName}/${subjectName}/researches`);

  for (const entry of entries) {
    const entryPath = path.join(researchPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in researches folder: ${toDisplayPath(entryPath)} [_core-adr-policy-006]`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid research file name: ${toDisplayPath(entryPath)} [_core-adr-policy-006]`);
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = researchNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate research number ${number} in ${scopeName}/${typeName}/${subjectName}/researches: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)} [_core-adr-policy-006]`);
    } else {
      researchNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Research file name must be lowercase: ${toDisplayPath(entryPath)} [_core-adr-policy-006]`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const typeId = TYPE_TO_ID[typeName].split('-')[0]; // 'adr', 'bdr', or 'edr'
    const expectedHeader = `# ${scopeName}-${typeId}-research-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Research title must start with "${expectedHeader}": ${toDisplayPath(entryPath)} [_core-adr-policy-006]`);
    }

    lintRequiredSections(content, entryPath, RESEARCH_REQUIRED_SECTIONS, 'Research', errors);
    lintResearchIntroductionQuestion(content, entryPath, errors);
    lintResearchSectionWordLimits(content, entryPath, errors);
    lintNoEmojis(content, entryPath, 'Research', errors);
    lintWordCount(content, entryPath, 'Research', RESEARCH_MAX_WORDS, errors);
    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors, externalScopes);
  }

  lintOrphanAssets(path.join(researchPath, RESOURCE_DIR_NAME), artifacts, xdrsRoot, errors);

  return artifacts;
}

function lintInitiativesDirectory(xdrsRoot, scopeName, typeName, subjectName, initiativesPath, errors, externalScopes = new Set()) {
  const artifacts = [];
  const initiativeNumbers = new Map();
  const entries = safeReadDir(initiativesPath, errors, `read initiatives directory ${scopeName}/${typeName}/${subjectName}/initiatives`);

  for (const entry of entries) {
    const entryPath = path.join(initiativesPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in initiatives folder: ${toDisplayPath(entryPath)} [_core-adr-policy-007]`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid initiative file name: ${toDisplayPath(entryPath)} [_core-adr-policy-007]`);
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = initiativeNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate initiative number ${number} in ${scopeName}/${typeName}/${subjectName}/initiatives: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)} [_core-adr-policy-007]`);
    } else {
      initiativeNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Initiative file name must be lowercase: ${toDisplayPath(entryPath)} [_core-adr-policy-007]`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const typeId = TYPE_TO_ID[typeName].split('-')[0]; // 'adr', 'bdr', or 'edr'
    const expectedHeader = `# ${scopeName}-${typeId}-initiative-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Initiative title must start with "${expectedHeader}": ${toDisplayPath(entryPath)} [_core-adr-policy-007]`);
    }

    lintRequiredSections(content, entryPath, INITIATIVE_REQUIRED_SECTIONS, 'Initiative', errors);
    lintInitiativeExpectedEndDate(content, entryPath, errors);
    lintNoEmojis(content, entryPath, 'Initiative', errors);
    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors, externalScopes);
  }

  lintOrphanAssets(path.join(initiativesPath, RESOURCE_DIR_NAME), artifacts, xdrsRoot, errors);

  return artifacts;
}

/**
 * Returns true when at least one policy file in dirPath does NOT have freeze-reference: true.
 * Used to decide whether an invalid-subject-folder error should be reported.
 */
function hasAnyNonFrozenPolicy(dirPath) {
  let entries;
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return false; }
  for (const entry of entries) {
    if (!entry.isFile() || !NUMBERED_FILE_RE.test(entry.name)) continue;
    let content;
    try { content = fs.readFileSync(path.join(dirPath, entry.name), 'utf8'); } catch { return true; }
    const fm = extractFrontmatter(content);
    if (!fm.freezeReference) return true;
  }
  return false;
}

function lintPolicyNumberRange(number, subjectName, content, filePath, errors, warnings) {
  const fm = extractFrontmatter(content);
  const num = parseInt(number, 10);
  if (num >= RESERVED_NUMBER_RANGE_MIN && num <= RESERVED_NUMBER_RANGE_MAX) {
    const msg = `Policy number ${number} is in the reserved range (801–900) which MUST NOT be assigned: ${toDisplayPath(filePath)} [_core-adr-policy-017.05-reserved-gap-must-not-be-assigned]`;
    if (fm.freezeReference) { warnings.push(`${msg} [exempt: freeze-reference]`); } else { errors.push(msg); }
    return;
  }
  if (num < OVERFLOW_RANGE_MIN) {
    const range = SUBJECT_NUMBER_RANGES[subjectName];
    if (range && (num < range[0] || num > range[1])) {
      const msg = `Policy number ${number} is outside the ${range[0]}–${range[1]} block reserved for subject "${subjectName}": ${toDisplayPath(filePath)} [_core-adr-policy-017.01-numbering-blocks-per-subject]`;
      if (fm.freezeReference) { warnings.push(`${msg} [exempt: freeze-reference]`); } else { errors.push(msg); }
    }
  }
}

function lintNoEmojis(content, filePath, docType, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  for (let i = 0; i < lines.length; i++) {
    if (ignoredLines[i]) continue;
    if (EMOJI_RE.test(lines[i])) {
      errors.push(`${docType} must not contain emojis: ${toDisplayPath(filePath)}:${i + 1} ${DOC_TYPE_POLICY_REF[docType] || ''}`);
    }
  }
}

function lintWordCount(content, filePath, docType, maxWords, errors) {
  const body = stripFrontmatter(content);
  const wordCount = countWords(body);
  if (wordCount > maxWords) {
    errors.push(`${docType} exceeds maximum word count of ${maxWords} (${wordCount} words): ${toDisplayPath(filePath)} ${DOC_TYPE_POLICY_REF[docType] || ''}`);
  }
}

function lintResearchIntroductionQuestion(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const introStart = findHeadingLine(lines, ignoredLines, '## Introduction');
  if (introStart === -1) return; // Already caught by lintRequiredSections

  let introEnd = lines.length;
  for (let i = introStart + 1; i < lines.length; i++) {
    if (!ignoredLines[i] && /^## /.test(lines[i].trim())) {
      introEnd = i;
      break;
    }
  }

  let hasQuestion = false;
  for (let i = introStart + 1; i < introEnd; i++) {
    if (!ignoredLines[i] && lines[i].trim().startsWith('Question:')) {
      hasQuestion = true;
      break;
    }
  }

  if (!hasQuestion) {
    errors.push(`Research ## Introduction must contain a "Question:" line: ${toDisplayPath(filePath)} [_core-adr-policy-006]`);
  }
}

const XDRS_REQUIRED_SECTIONS = ['## Context and Problem Statement', '## Decision Outcome'];
const ARTICLE_REQUIRED_SECTIONS = ['## Overview', '## Content', '## References'];
const RESEARCH_REQUIRED_SECTIONS = ['## Abstract', '## Introduction', '## Methods', '## Results', '## Discussion', '## Conclusion', '## References'];
const INITIATIVE_REQUIRED_SECTIONS = ['## Executive Summary', '## Context and Problem Statement', '## Proposed Solution'];
const SKILL_REQUIRED_SECTIONS = ['## Overview', '## Instructions'];

function lintRequiredSections(content, filePath, requiredSections, docType, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  for (const section of requiredSections) {
    if (findHeadingLine(lines, ignoredLines, section) === -1) {
      errors.push(`${docType} is missing required section "${section}": ${toDisplayPath(filePath)} ${DOC_TYPE_POLICY_REF[docType] || ''}`);
    }
  }
}

function lintInitiativeExpectedEndDate(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const expectedEndDateLines = findFieldLines(lines, ignoredLines, 'Expected end date:');

  if (expectedEndDateLines.length === 0) {
    errors.push(`Initiative must include an Expected end date: field: ${toDisplayPath(filePath)} [_core-adr-policy-007]`);
    return;
  }

  if (expectedEndDateLines.length > 1) {
    errors.push(`Initiative must not repeat Expected end date: ${toDisplayPath(filePath)} [_core-adr-policy-007]`);
  }

  const value = lines[expectedEndDateLines[0]].slice('Expected end date:'.length).trim().replace(/\.$/, '');
  if (!isIsoDate(value)) {
    errors.push(`Initiative Expected end date: must be a valid ISO date in YYYY-MM-DD format: ${toDisplayPath(filePath)} [_core-adr-policy-007]`);
  }
}

function lintTypeIndex(indexPath, xdrsRoot, artifacts, errors, externalScopes = new Set()) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const repoRoot = path.dirname(xdrsRoot);
  const localLinks = parseLocalLinks(content, path.dirname(indexPath), repoRoot);
  const linkedSet = new Set();
  const scopeName = path.relative(xdrsRoot, indexPath).split(path.sep)[0];
  const localScopePath = normalizePath(path.join(xdrsRoot, '_local'));

  for (const linkPath of localLinks) {
    if (!fs.existsSync(linkPath)) {
      if (isExternalScopeLink(linkPath, xdrsRoot, externalScopes)) continue;
      errors.push(`Broken link in canonical index ${toDisplayPath(indexPath)}: ${displayPath(indexPath, linkPath)} [_core-adr-policy-001]`);
      continue;
    }

    if (scopeName !== '_local' && (isPathInside(localScopePath, linkPath) || normalizePath(linkPath) === localScopePath)) {
      errors.push(`Non-_local document must not link into _local scope: ${displayPath(indexPath, linkPath)} [_core-adr-policy-001]`);
    }

    linkedSet.add(normalizePath(linkPath));
  }

  for (const artifactPath of artifacts) {
    if (!linkedSet.has(normalizePath(artifactPath))) {
      errors.push(`Canonical index ${toDisplayPath(indexPath)} is missing an entry for ${toDisplayPath(artifactPath)} [_core-adr-policy-001]`);
    }
  }
}

function lintOrphanAssets(assetsDir, documentPaths, xdrsRoot, errors) {
  if (!existsDirectory(assetsDir)) {
    return;
  }

  const assetTree = collectAssetTree(assetsDir, errors);
  if (assetTree.files.length === 0 && assetTree.directories.length === 0) {
    return;
  }

  const repoRoot = path.dirname(xdrsRoot);
  const referencedAssets = new Set();

  for (const docPath of documentPaths) {
    if (!existsFile(docPath)) {
      continue;
    }
    const content = fs.readFileSync(docPath, 'utf8');
    const docDir = path.dirname(docPath);
    const links = parseLocalLinks(content, docDir, repoRoot);
    for (const linkPath of links) {
      referencedAssets.add(normalizePath(linkPath));
    }
  }

  for (const assetPath of assetTree.files) {
    if (!referencedAssets.has(assetPath)) {
      errors.push(`Orphan asset file not referenced by any document: ${toDisplayPath(assetPath)} [_core-adr-policy-001]`);
    }
  }

  // Lint slide/presentation files inside .assets
  for (const assetPath of assetTree.files) {
    const fileName = path.basename(assetPath);
    if (SLIDE_FILE_RE.test(fileName)) {
      lintSlideFile(assetPath, documentPaths, xdrsRoot, errors);
    }
  }
}

function lintSlideFile(filePath, documentPaths, xdrsRoot, errors) {
  const fileName = path.basename(filePath);

  if (fileName !== fileName.toLowerCase()) {
    errors.push(`Slide file name must be lowercase: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
  }

  if (fileName.length > SLIDE_MAX_NAME_LENGTH) {
    errors.push(`Slide file name must be ${SLIDE_MAX_NAME_LENGTH} characters or fewer: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
  }

  const content = fs.readFileSync(filePath, 'utf8');

  const fm = extractFrontmatter(content);
  if (!fm.present) {
    errors.push(`Slide file must start with a YAML frontmatter block containing marp: true: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
  } else {
    const frontmatterBody = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
    const firstKey = frontmatterBody.trimStart().split(/\r?\n/)[0];
    if (!/^marp:\s*true$/.test(firstKey)) {
      errors.push(`Slide frontmatter must include marp: true as the first key: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
    }
  }

  lintNoEmojis(content, filePath, 'Slide', errors);

  // Check that the slide links back to at least one parent document
  const repoRoot = path.dirname(xdrsRoot);
  const slideDir = path.dirname(filePath);
  const slideLinks = parseLocalLinks(content, slideDir, repoRoot);
  const slideLinkSet = new Set(slideLinks.map(normalizePath));

  const linksToParent = documentPaths.some((docPath) => slideLinkSet.has(normalizePath(docPath)));
  if (!linksToParent) {
    errors.push(`Slide file must contain a link back to its parent document: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
  }

  // Check that at least one parent document links to this slide file
  const parentLinksToSlide = documentPaths.some((docPath) => {
    if (!existsFile(docPath)) return false;
    const docContent = fs.readFileSync(docPath, 'utf8');
    const docLinks = parseLocalLinks(docContent, path.dirname(docPath), repoRoot);
    return docLinks.some((l) => normalizePath(l) === normalizePath(filePath));
  });
  if (!parentLinksToSlide) {
    errors.push(`Parent document must contain a link to its slide file: ${toDisplayPath(filePath)} [_core-adr-policy-009]`);
  }
}

function collectAssetTree(dirPath, errors) {
  const files = [];
  const directories = [];
  const entries = safeReadDir(dirPath, errors, `read assets directory ${toDisplayPath(dirPath)}`);

  for (const entry of entries) {
    const entryPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      directories.push(normalizePath(entryPath));
      const nestedTree = collectAssetTree(entryPath, errors);
      directories.push(...nestedTree.directories);
      files.push(...nestedTree.files);
      continue;
    }

    if (entry.isFile()) {
      files.push(normalizePath(entryPath));
    }
  }

  return { files, directories };
}

function lintDocumentLinks(documentPath, xdrsRoot, scopeName, errors, externalScopes = new Set()) {
  const lines = fs.readFileSync(documentPath, 'utf8').split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const documentDir = path.dirname(documentPath);
  const resourceDir = path.join(documentDir, RESOURCE_DIR_NAME);
  const localScopePath = normalizePath(path.join(xdrsRoot, '_local'));
  const repoRoot = path.dirname(xdrsRoot);

  for (let index = 0; index < lines.length; index += 1) {
    if (ignoredLines[index]) {
      continue;
    }

    for (const link of parseLocalLinkTargets(lines[index], documentDir, repoRoot)) {
      const isResourceLink = shouldValidateResourceLink(link.rawTarget);

      if (!isResourceLink && link.isAbsolutePath) {
        errors.push(`Absolute path links are not allowed; use relative paths in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget} [_core-adr-policy-001]`);
      }

      if (!fs.existsSync(link.resolvedPath)) {
        if (isExternalScopeLink(link.resolvedPath, xdrsRoot, externalScopes)) continue;
        if (isResourceLink) {
          errors.push(`Broken asset link in ${toDisplayPath(documentPath)}: ${link.rawTarget} [_core-adr-policy-001]`);
        } else {
          errors.push(`Broken local link in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget} [_core-adr-policy-001]`);
        }
        continue;
      }

      if (scopeName !== '_local' && (isPathInside(localScopePath, link.resolvedPath) || normalizePath(link.resolvedPath) === localScopePath)) {
        errors.push(`Non-_local document must not link into _local scope in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget} [_core-adr-policy-001]`);
      }

      if (isResourceLink && !isPathInside(resourceDir, link.resolvedPath)) {
        errors.push(`Asset links in ${toDisplayPath(documentPath)} must point to ${toDisplayPath(resourceDir)}: ${link.rawTarget} [_core-adr-policy-001]`);
      }
    }
  }
}

function parseLocalLinks(markdown, baseDir, repoRoot) {
  return parseLocalLinkTargets(markdown, baseDir, repoRoot).map((link) => link.resolvedPath);
}

function parseLocalLinkTargets(markdown, baseDir, repoRoot) {
  const links = [];
  const linkRe = /!?\[[^\]]+\]\(([^)]+)\)/g;
  let match = linkRe.exec(markdown);
  while (match) {
    const rawTarget = match[1].trim();
    const normalizedTarget = normalizeLocalLinkTarget(rawTarget);
    if (normalizedTarget) {
      const isAbsolutePath = normalizedTarget.startsWith('/');
      links.push({
        rawTarget,
        resolvedPath: isAbsolutePath && repoRoot
          ? path.join(repoRoot, normalizedTarget)
          : path.resolve(baseDir, normalizedTarget),
        isAbsolutePath
      });
    }
    match = linkRe.exec(markdown);
  }
  return links;
}

function normalizeLocalLinkTarget(target) {
  if (!isLocalLink(target)) {
    return null;
  }

  const bracketWrappedTarget = target.match(/^<(.+)>$/);
  const cleanedTarget = bracketWrappedTarget ? bracketWrappedTarget[1] : target;

  return cleanedTarget.split('#')[0].split('?')[0] || null;
}

function isLocalLink(target) {
  return target !== ''
    && !target.startsWith('#')
    && !target.startsWith('http://')
    && !target.startsWith('https://')
    && !target.startsWith('mailto:');
}

function isCanonicalTypeIndex(filePath, xdrsRoot) {
  const relative = relativeFrom(xdrsRoot, filePath).split(path.sep);
  return relative.length === 3 && TYPE_NAMES.has(relative[1]) && relative[2] === 'index.md';
}

function isScopeIndex(filePath, xdrsRoot) {
  const relative = relativeFrom(xdrsRoot, filePath).split(path.sep);
  return relative.length === 2 && relative[1] === 'index.md';
}

function isExternalScopeLink(resolvedPath, xdrsRoot, externalScopes) {
  if (!isPathInside(xdrsRoot, resolvedPath)) return false;
  const relative = path.relative(xdrsRoot, resolvedPath);
  const parts = relative.split(path.sep);
  if (parts.length === 0 || !parts[0]) return false;
  const scopeName = parts[0];

  // Treat as external if explicitly listed via .filedist.lock OR if the scope directory
  // doesn't exist locally (e.g. hasn't been extracted from an external package yet)
  return externalScopes.has(scopeName) || !existsDirectory(path.join(xdrsRoot, scopeName));
}

function shouldValidateResourceLink(rawTarget) {
  const normalizedTargetPath = normalizeLocalLinkTarget(rawTarget);
  if (!normalizedTargetPath) {
    return false;
  }

  const normalizedTarget = normalizedTargetPath.replace(/\\/g, '/');
  const extension = path.extname(normalizedTargetPath).toLowerCase();

  return normalizedTarget === RESOURCE_DIR_NAME
    || normalizedTarget.startsWith(`${RESOURCE_DIR_NAME}/`)
    || normalizedTarget.includes(`/${RESOURCE_DIR_NAME}/`)
    || IMAGE_EXTENSIONS.has(extension);
}

function extractDescriptionText(block) {
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^description:\s*(.*)$/);
    if (!m) continue;
    const inlineValue = m[1].trim();
    if (inlineValue && inlineValue !== '>' && inlineValue !== '|') {
      return inlineValue;
    }
    // Block scalar: collect following indented lines
    const bodyLines = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === '' || /^\s+/.test(lines[j])) {
        bodyLines.push(lines[j].trim());
      } else {
        break;
      }
    }
    return bodyLines.join(' ').trim() || null;
  }
  return null;
}

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) {
    return { present: false, name: null, description: false, descriptionText: null, validFrom: undefined, appliedTo: undefined, topLevelKeys: [] };
  }
  const block = match[1];
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  const validFromMatch = block.match(/^valid-from:\s*(.+)$/m);
  const appliedToMatch = block.match(/^apply-to:\s*(.+)$/m);
  const topLevelKeys = [];
  for (const line of block.split('\n')) {
    const keyMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*/);
    if (keyMatch) topLevelKeys.push(keyMatch[1]);
  }
  const freezeReferenceMatch = block.match(/^freeze-reference:\s*(.+)$/m);
  const descriptionText = extractDescriptionText(block);
  return {
    present: true,
    name: nameMatch ? nameMatch[1].trim() || null : null,
    description: /^description:\s*\S/m.test(block),
    descriptionText,
    validFrom: validFromMatch ? validFromMatch[1].trim() : undefined,
    appliedTo: appliedToMatch ? appliedToMatch[1].trim() : undefined,
    freezeReference: freezeReferenceMatch ? freezeReferenceMatch[1].trim() === 'true' : false,
    topLevelKeys,
  };
}

function stripFrontmatter(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? content.slice(match[0].length) : content;
}

/**
 * Validate that a policy file follows the structured format defined in policy-008:
 * must have a "### Details" section and at least one "#### NN-rulename" rule block.
 */
function validateStructuredFormat(filePath, errors, errorCode) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  validateStructuredFormatContent(content, filePath, errors, errorCode);
}

function validateStructuredFormatContent(content, filePath, errors, errorCode) {
  const body = stripFrontmatter(content);
  if (!/^### Details\s*$/m.test(body)) {
    errors.push(`Policy must have a "### Details" section: ${toDisplayPath(filePath)} [${errorCode}]`);
    return;
  }
  if (!/^#### \d{2}-[a-z][a-z0-9-]*$/m.test(body)) {
    errors.push(`Policy must have at least one structured rule block (#### NN-rulename) in ### Details: ${toDisplayPath(filePath)} [${errorCode}]`);
    return;
  }
  lintStructuredRuleBlocks(content, filePath, errors);
}

function lintCompiledPolicySourceSection(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const sourceStart = findHeadingLine(lines, ignoredLines, '## Source');
  if (sourceStart === -1) {
    errors.push(`Compiled policy must include a "## Source" section: ${toDisplayPath(filePath)} [_core-adr-policy-019.10-source-section]`);
    return;
  }
  // Find end of ## Source section (next ## heading or EOF)
  let sourceEnd = lines.length;
  for (let i = sourceStart + 1; i < lines.length; i++) {
    if (!ignoredLines[i] && /^## /.test(lines[i])) {
      sourceEnd = i;
      break;
    }
  }
  // Paths in ## Source MUST NOT be written as markdown links
  const MD_LINK_RE = /\[.+?\]\(.+?\)/;
  for (let i = sourceStart + 1; i < sourceEnd; i++) {
    if (!ignoredLines[i] && MD_LINK_RE.test(lines[i])) {
      errors.push(`Compiled policy "## Source" section must not use markdown links (use plain text paths): ${toDisplayPath(filePath)}:${i + 1} [_core-adr-policy-019.10-source-section]`);
      break;
    }
  }
}

function findIgnoredMarkdownLines(lines) {
  const ignored = [];
  let inCodeFence = false;
  let activeFence = null;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      ignored[index] = true;
      if (activeFence === fenceMatch[1][0]) {
        activeFence = null;
        inCodeFence = false;
      } else if (activeFence === null) {
        activeFence = fenceMatch[1][0];
        inCodeFence = true;
      }
      continue;
    }

    ignored[index] = inCodeFence;
  }

  return ignored;
}

function findHeadingLine(lines, ignoredLines, headingText) {
  for (let index = 0; index < lines.length; index += 1) {
    if (ignoredLines[index]) {
      continue;
    }
    if (lines[index].trim() === headingText) {
      return index;
    }
  }
  return -1;
}

function findHeadingLines(lines, ignoredLines) {
  const result = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (ignoredLines[index]) {
      continue;
    }
    if (/^##\s+/.test(lines[index].trim())) {
      result.push(index);
    }
  }
  return result;
}

function findFieldLines(lines, ignoredLines, prefix) {
  const result = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (ignoredLines[index]) {
      continue;
    }
    if (lines[index].trim().startsWith(prefix)) {
      result.push(index);
    }
  }
  return result;
}

function isLineInsideRange(lineIndex, range) {
  return lineIndex >= range.start && lineIndex <= range.end;
}

function countWords(value) {
  return value.split(/\s+/).filter(Boolean).length;
}

function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function firstNonEmptyLine(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() !== '') {
      return line.trim();
    }
  }
  return '';
}

function safeReadDir(dirPath, errors, operation) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    errors.push(`Failed to ${operation}: ${toDisplayPath(dirPath)} (${error.message})`);
    return [];
  }
}

function isValidScopeName(scopeName) {
  if (RESERVED_SCOPES.has(scopeName)) {
    return true;
  }
  return /^[a-z0-9][a-z0-9-]*$/.test(scopeName);
}

function existsDirectory(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function existsFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function loadFiledist(repoRoot) {
  const filedistPath = path.join(repoRoot, '.filedist.lock');
  if (!existsFile(filedistPath)) {
    return new Set();
  }
  const content = fs.readFileSync(filedistPath, 'utf8');
  const paths = new Set();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const parts = trimmed.split('|');
    if (parts.length >= 2) {
      paths.add(normalizePath(path.join(repoRoot, parts[0])));
    }
  }
  return paths;
}

function getExternalScopes(filedistPaths, xdrsRoot) {
  const externalScopes = new Set();
  for (const filePath of filedistPaths) {
    const relative = path.relative(xdrsRoot, filePath);
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      const parts = relative.split(path.sep);
      if (parts.length >= 1 && parts[0]) {
        externalScopes.add(parts[0]);
      }
    }
  }
  return externalScopes;
}

function displayPath(indexPath, targetPath) {
  return `${toDisplayPath(indexPath)} -> ${toDisplayPath(targetPath)}`;
}

function toDisplayPath(targetPath) {
  return relativeFrom(process.cwd(), targetPath);
}

function relativeFrom(basePath, targetPath) {
  return path.relative(basePath, targetPath) || '.';
}

function normalizePath(filePath) {
  return path.normalize(filePath);
}

function isPathInside(parentPath, childPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function lintStructuredRuleBlocks(content, filePath, errors) {
  const body = stripFrontmatter(content);
  const lines = body.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);

  const ruleNumbers = new Map(); // number -> line index
  const ruleEntries = [];

  for (let i = 0; i < lines.length; i++) {
    if (ignoredLines[i]) continue;
    const m = lines[i].match(/^#### (\d+)-(.*)$/);
    if (!m) continue;
    const number = m[1];
    const title = m[2].trim();
    ruleEntries.push({ lineIndex: i, number, title });
  }

  for (let r = 0; r < ruleEntries.length; r++) {
    const { lineIndex, number, title } = ruleEntries[r];

    if (!/^\d{2}$/.test(number)) {
      errors.push(`Policy structured rule number must be exactly two digits ("${number}" in "${lines[lineIndex].trim()}"): ${toDisplayPath(filePath)} [_core-adr-policy-008.02-rule-numbering-must-be-stable]`);
    }

    if (title.length === 0 || !/^[a-z][a-z0-9-]*$/.test(title)) {
      if (/[A-Z]/.test(title)) {
        errors.push(`Policy structured rule title must be all lowercase ("${title}"): ${toDisplayPath(filePath)} [_core-adr-policy-008.05-rule-title-must-be-all-lowercase]`);
      } else {
        errors.push(`Policy structured rule title must be in kebab-case ("${title}"): ${toDisplayPath(filePath)} [_core-adr-policy-008.01-always-use-numbered-rules-for-strong-or-referenceable-policies]`);
      }
    }

    const wordCount = title.split('-').filter(Boolean).length;
    if (wordCount > 12) {
      errors.push(`Policy structured rule title must be 12 words or fewer ("${title}"): ${toDisplayPath(filePath)} [_core-adr-policy-008.01-always-use-numbered-rules-for-strong-or-referenceable-policies]`);
    }

    if (ruleNumbers.has(number)) {
      errors.push(`Duplicate structured rule number "${number}" in Policy: ${toDisplayPath(filePath)} [_core-adr-policy-008.02-rule-numbering-must-be-stable]`);
    } else {
      ruleNumbers.set(number, lineIndex);
    }

    const bodyStart = lineIndex + 1;
    let bodyEnd = lines.length;
    for (let i = bodyStart; i < lines.length; i++) {
      if (!ignoredLines[i] && /^#{1,4}/.test(lines[i])) {
        bodyEnd = i;
        break;
      }
    }
    const ruleBodyText = lines.slice(bodyStart, bodyEnd).join('\n');
    const ruleBodyNonCodeLines = lines.slice(bodyStart, bodyEnd).filter((_, idx) => !ignoredLines[bodyStart + idx]);
    const ruleBodyTextForEmphasis = ruleBodyNonCodeLines.join('\n');

    if (!NORMATIVE_KEYWORDS_RE.test(ruleBodyTextForEmphasis)) {
      errors.push(`Policy structured rule body must contain normative language (MUST/SHOULD/MAY) in "${number}-${title}": ${toDisplayPath(filePath)} [_core-adr-policy-008.03-rule-body-must-use-normative-language]`);
    }

    if (NORMATIVE_EMPHASIS_RE.test(ruleBodyTextForEmphasis)) {
      errors.push(`Policy structured rule body must not use bold or italic marks around normative keywords in "${number}-${title}": ${toDisplayPath(filePath)} [_core-adr-policy-008.06-normative-keywords-must-not-use-emphasis-marks]`);
    }
  }
}

function lintResearchSectionWordLimits(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);

  const sectionStarts = {};
  for (let i = 0; i < lines.length; i++) {
    if (ignoredLines[i]) continue;
    const trimmed = lines[i].trim();
    for (const sectionName of Object.keys(RESEARCH_SECTION_LIMITS)) {
      if (trimmed === sectionName) {
        sectionStarts[sectionName] = i;
      }
    }
  }

  for (const sectionName of Object.keys(RESEARCH_SECTION_LIMITS)) {
    const startLine = sectionStarts[sectionName];
    if (startLine === undefined) continue;

    let endLine = lines.length;
    for (let i = startLine + 1; i < lines.length; i++) {
      if (!ignoredLines[i] && /^## /.test(lines[i].trim())) {
        endLine = i;
        break;
      }
    }

    const sectionText = lines.slice(startLine + 1, endLine).join(' ');
    const wordCount = countWords(sectionText);
    const limit = RESEARCH_SECTION_LIMITS[sectionName];

    if (wordCount > limit) {
      errors.push(`Research ${sectionName} section exceeds ${limit} words (${wordCount} words): ${toDisplayPath(filePath)} [_core-adr-policy-006]`);
    }
  }
}

module.exports = {
  runLintCli,
  lintWorkspace
};

if (require.main === module) {
  process.exitCode = runLintCli(process.argv.slice(2));
}