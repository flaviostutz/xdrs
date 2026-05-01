#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const TYPE_TO_ID = {
  adrs: 'adr',
  bdrs: 'bdr',
  edrs: 'edr'
};

const ALLOWED_SUBJECTS = {
  adrs: new Set(['principles', 'application', 'data', 'integration', 'platform', 'controls', 'operations']),
  bdrs: new Set(['principles', 'marketing', 'product', 'controls', 'operations', 'organization', 'finance', 'sustainability']),
  edrs: new Set(['principles', 'application', 'infra', 'observability', 'devops', 'governance'])
};

const TYPE_NAMES = new Set(Object.keys(TYPE_TO_ID));
const RESERVED_SCOPES = new Set(['_core', '_local']);
const NUMBERED_FILE_RE = /^(\d{3,})-([a-z0-9-]+)\.md$/;
const NUMBERED_DIR_RE = /^(\d{3,})-([a-z0-9-]+)$/;
const REQUIRED_ROOT_INDEX_TEXT = 'XDRs in scopes listed last override the ones listed first';
const SUBJECT_ARTIFACT_DIRS = new Set(['skills', 'articles', 'researches', 'plans']);
const RESOURCE_DIR_NAME = '.assets';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);

function runLintCli(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const all = args.includes('--all');
  const pathArgs = args.filter((a) => !a.startsWith('--'));
  const targetPath = pathArgs[0] || '.';
  const result = lintWorkspace(targetPath, { ignoreReadOnly: !all });

  if (result.errors.length === 0) {
    console.log(`Lint passed for ${toDisplayPath(result.xdrsRoot)}`);
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
  console.log('Lint the XDR tree rooted at [path]/.xdrs or at [path] when [path] already points to .xdrs.');
  console.log('\nOptions:');
  console.log('  --all    Check all files, including read-only files from other scopes (default: skip read-only files)');
  console.log('\nAll other commands continue to be delegated to the bundled filedist CLI.');
}

function lintWorkspace(targetPath, options = {}) {
  const { ignoreReadOnly = true } = options;
  const resolvedTarget = path.resolve(targetPath);
  const xdrsRoot = path.basename(resolvedTarget) === '.xdrs'
    ? resolvedTarget
    : path.join(resolvedTarget, '.xdrs');
  const errors = [];

  if (!existsDirectory(xdrsRoot)) {
    errors.push(`Missing XDR root directory: ${toDisplayPath(xdrsRoot)}`);
    return { xdrsRoot, errors };
  }

  const actualTypeIndexes = [];
  const rootEntries = safeReadDir(xdrsRoot, errors, 'read XDR root directory');
  const scopeEntries = rootEntries.filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'));

  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name !== 'index.md') {
      errors.push(`Unexpected file at .xdrs root: ${entry.name}`);
    }
  }

  for (const scopeEntry of scopeEntries) {
    lintScopeDirectory(xdrsRoot, scopeEntry.name, errors, actualTypeIndexes, ignoreReadOnly);
  }

  const rootIndexPath = path.join(xdrsRoot, 'index.md');
  if (!existsFile(rootIndexPath)) {
    errors.push('Missing required root index: .xdrs/index.md');
  } else {
    lintRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors);
  }

  return { xdrsRoot, errors };
}

function lintRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors) {
  const content = fs.readFileSync(rootIndexPath, 'utf8');
  const repoRoot = path.dirname(xdrsRoot);

  if (!content.includes(REQUIRED_ROOT_INDEX_TEXT)) {
    errors.push(`Root index is missing required override text: ${toDisplayPath(rootIndexPath)}`);
  }

  const links = parseLocalLinks(content, path.dirname(rootIndexPath), repoRoot);
  for (const linkPath of links) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in root index: ${displayPath(rootIndexPath, linkPath)}`);
    }
  }

  const linkedTypeIndexes = links.filter((linkPath) => isCanonicalTypeIndex(linkPath, xdrsRoot));
  const linkedSet = new Set(linkedTypeIndexes.map(normalizePath));
  const localScopePath = normalizePath(path.join(xdrsRoot, '_local'));

  for (const linkPath of links) {
    if (isPathInside(localScopePath, linkPath) || normalizePath(linkPath) === localScopePath) {
      errors.push(`Root index must not link into _local scope: ${displayPath(rootIndexPath, linkPath)}`);
    }
  }

  for (const indexPath of actualTypeIndexes) {
    const scopeName = path.basename(path.dirname(path.dirname(indexPath)));
    if (scopeName === '_local') {
      continue;
    }
    if (!linkedSet.has(normalizePath(indexPath))) {
      errors.push(`Root index is missing canonical index link: ${toDisplayPath(indexPath)}`);
    }
  }
}

function lintScopeDirectory(xdrsRoot, scopeName, errors, actualTypeIndexes, ignoreReadOnly) {
  const scopePath = path.join(xdrsRoot, scopeName);

  if (ignoreReadOnly && isReadOnly(scopePath)) {
    return;
  }

  if (!isValidScopeName(scopeName)) {
    errors.push(`Invalid scope name: ${toDisplayPath(scopePath)}`);
  }

  const entries = safeReadDir(scopePath, errors, `read scope directory ${scopeName}`);
  for (const entry of entries) {
    const entryPath = path.join(scopePath, entry.name);
    if (entry.isDirectory()) {
      if (!TYPE_NAMES.has(entry.name)) {
        errors.push(`Unexpected directory under scope ${scopeName}: ${toDisplayPath(entryPath)}`);
        continue;
      }
      lintTypeDirectory(xdrsRoot, scopeName, entry.name, errors, actualTypeIndexes, ignoreReadOnly);
      continue;
    }

    errors.push(`Unexpected file under scope ${scopeName}: ${toDisplayPath(entryPath)}`);
  }
}

function lintTypeDirectory(xdrsRoot, scopeName, typeName, errors, actualTypeIndexes, ignoreReadOnly) {
  const typePath = path.join(xdrsRoot, scopeName, typeName);
  const indexPath = path.join(typePath, 'index.md');
  const xdrNumbers = new Map();
  const artifacts = [];

  if (!existsFile(indexPath)) {
    errors.push(`Missing canonical index: ${toDisplayPath(indexPath)}`);
  } else if (!shouldSkipReadOnlyPath(indexPath, ignoreReadOnly)) {
    actualTypeIndexes.push(indexPath);
  }

  const entries = safeReadDir(typePath, errors, `read type directory ${scopeName}/${typeName}`);
  for (const entry of entries) {
    const entryPath = path.join(typePath, entry.name);
    if (entry.isFile()) {
      if (entry.name !== 'index.md') {
        errors.push(`Unexpected file under ${scopeName}/${typeName}: ${toDisplayPath(entryPath)}`);
      }
      continue;
    }

    if (!ALLOWED_SUBJECTS[typeName].has(entry.name)) {
      errors.push(`Invalid subject folder for ${typeName}: ${toDisplayPath(entryPath)}`);
      continue;
    }

    artifacts.push(...lintSubjectDirectory(xdrsRoot, scopeName, typeName, entry.name, xdrNumbers, errors, ignoreReadOnly));
  }

  if (existsFile(indexPath) && !shouldSkipReadOnlyPath(indexPath, ignoreReadOnly)) {
    lintTypeIndex(indexPath, xdrsRoot, artifacts, errors);
  }
}

function lintSubjectDirectory(xdrsRoot, scopeName, typeName, subjectName, xdrNumbers, errors, ignoreReadOnly) {
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
        artifacts.push(...lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, ignoreReadOnly));
        continue;
      }
      if (entry.name === 'articles') {
        artifacts.push(...lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, ignoreReadOnly));
        continue;
      }
      if (entry.name === 'researches') {
        artifacts.push(...lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, ignoreReadOnly));
        continue;
      }
      if (entry.name === 'plans') {
        artifacts.push(...lintPlansDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors, ignoreReadOnly));
        continue;
      }

      errors.push(`Unexpected directory under ${scopeName}/${typeName}/${subjectName}: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (!NUMBERED_FILE_RE.test(entry.name)) {
      errors.push(`Invalid XDR file name: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (shouldSkipReadOnlyPath(entryPath, ignoreReadOnly)) {
      continue;
    }

    artifacts.push(entryPath);
    lintXdrFile(xdrsRoot, scopeName, typeName, entryPath, xdrNumbers, errors);
  }

  return artifacts;
}

function lintXdrFile(xdrsRoot, scopeName, typeName, filePath, xdrNumbers, errors) {
  const baseName = path.basename(filePath);
  const match = baseName.match(NUMBERED_FILE_RE);
  if (!match) {
    return;
  }

  const number = match[1];
  const previous = xdrNumbers.get(number);
  if (previous) {
    errors.push(`Duplicate XDR number ${number} in ${scopeName}/${typeName}: ${toDisplayPath(previous)} and ${toDisplayPath(filePath)}`);
  } else {
    xdrNumbers.set(number, filePath);
  }

  if (baseName !== baseName.toLowerCase()) {
    errors.push(`XDR file name must be lowercase: ${toDisplayPath(filePath)}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const expectedHeader = `# ${scopeName}-${TYPE_TO_ID[typeName]}-${number}:`;
  const firstLine = firstNonEmptyLine(stripFrontmatter(content));
  if (!firstLine.startsWith(expectedHeader)) {
    errors.push(`XDR title must start with "${expectedHeader}": ${toDisplayPath(filePath)}`);
  }

  const expectedName = extractExpectedXdrNameFromHeading(firstLine)
    || `${scopeName}-${TYPE_TO_ID[typeName]}-${number}-${match[2]}`;
  lintXdrFrontmatter(content, expectedName, filePath, errors);
  lintDocumentLinks(filePath, xdrsRoot, scopeName, errors);
}

function extractExpectedXdrNameFromHeading(headingLine) {
  const match = headingLine.match(/^#\s+([a-z0-9_]+-(?:adr|bdr|edr)-\d{3,}):\s+(.+?)\s*$/);
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

function lintXdrFrontmatter(content, expectedName, filePath, errors) {
  const fm = extractFrontmatter(content);
  if (!fm.present) {
    errors.push(`XDR must start with a YAML frontmatter block: ${toDisplayPath(filePath)}`);
    return;
  }
  if (!fm.name) {
    errors.push(`XDR frontmatter must include a non-empty name field: ${toDisplayPath(filePath)}`);
  } else if (fm.name !== expectedName) {
    errors.push(`XDR frontmatter name must be "${expectedName}": ${toDisplayPath(filePath)}`);
  }
  if (!fm.description) {
    errors.push(`XDR frontmatter must include a non-empty description field: ${toDisplayPath(filePath)}`);
  }
  if (fm.validFrom !== undefined) {
    if (!isIsoDate(fm.validFrom)) {
      errors.push(`XDR frontmatter valid-from must be a valid ISO date YYYY-MM-DD: ${toDisplayPath(filePath)}`);
    }
  }
  if (fm.appliedTo !== undefined) {
    const words = countWords(fm.appliedTo);
    if (words === 0) {
      errors.push(`XDR frontmatter applied-to must not be empty: ${toDisplayPath(filePath)}`);
    } else if (words >= 40) {
      errors.push(`XDR frontmatter applied-to must be under 40 words: ${toDisplayPath(filePath)}`);
    }
  }
}

function lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, skillsPath, errors, ignoreReadOnly) {
  const artifacts = [];
  const skillNumbers = new Map();
  const entries = safeReadDir(skillsPath, errors, `read skills directory ${scopeName}/${typeName}/${subjectName}/skills`);

  for (const entry of entries) {
    const entryPath = path.join(skillsPath, entry.name);
    if (!entry.isDirectory()) {
      errors.push(`Unexpected file in skills directory: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_DIR_RE);
    if (!match) {
      errors.push(`Invalid skill package name: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const number = match[1];
    const previous = skillNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate skill number ${number} in ${scopeName}/${typeName}/${subjectName}/skills: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)}`);
    } else {
      skillNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Skill package name must be lowercase: ${toDisplayPath(entryPath)}`);
    }

    const skillFilePath = path.join(entryPath, 'SKILL.md');

    if (!existsFile(skillFilePath)) {
      errors.push(`Missing SKILL.md in skill package: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (shouldSkipReadOnlyPath(skillFilePath, ignoreReadOnly)) {
      continue;
    }

    artifacts.push(skillFilePath);

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');
    const skillFm = extractFrontmatter(skillContent);
    if (!skillFm.present) {
      errors.push(`SKILL.md must start with a YAML frontmatter block: ${toDisplayPath(skillFilePath)}`);
    } else {
      if (!skillFm.name) {
        errors.push(`SKILL.md frontmatter must include a non-empty name field: ${toDisplayPath(skillFilePath)}`);
      } else if (skillFm.name !== entry.name) {
        errors.push(`Skill frontmatter name must match package directory "${entry.name}": ${toDisplayPath(skillFilePath)}`);
      }
      if (!skillFm.description) {
        errors.push(`SKILL.md frontmatter must include a non-empty description field: ${toDisplayPath(skillFilePath)}`);
      }
    }

    lintDocumentLinks(skillFilePath, xdrsRoot, scopeName, errors);
  }

  return artifacts;
}

function lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, articlesPath, errors, ignoreReadOnly) {
  const artifacts = [];
  const articleNumbers = new Map();
  const entries = safeReadDir(articlesPath, errors, `read articles directory ${scopeName}/${typeName}/${subjectName}/articles`);

  for (const entry of entries) {
    const entryPath = path.join(articlesPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in articles folder: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid article file name: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (shouldSkipReadOnlyPath(entryPath, ignoreReadOnly)) {
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = articleNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate article number ${number} in ${scopeName}/${typeName}/${subjectName}/articles: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)}`);
    } else {
      articleNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Article file name must be lowercase: ${toDisplayPath(entryPath)}`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const expectedHeader = `# ${scopeName}-article-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Article title must start with "${expectedHeader}": ${toDisplayPath(entryPath)}`);
    }

    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors);
  }

  return artifacts;
}

function lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, researchPath, errors, ignoreReadOnly) {
  const artifacts = [];
  const researchNumbers = new Map();
  const entries = safeReadDir(researchPath, errors, `read research directory ${scopeName}/${typeName}/${subjectName}/researches`);

  for (const entry of entries) {
    const entryPath = path.join(researchPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in researches folder: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid research file name: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (shouldSkipReadOnlyPath(entryPath, ignoreReadOnly)) {
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = researchNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate research number ${number} in ${scopeName}/${typeName}/${subjectName}/researches: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)}`);
    } else {
      researchNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Research file name must be lowercase: ${toDisplayPath(entryPath)}`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const expectedHeader = `# ${scopeName}-research-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Research title must start with "${expectedHeader}": ${toDisplayPath(entryPath)}`);
    }

    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors);
  }

  return artifacts;
}

function lintPlansDirectory(xdrsRoot, scopeName, typeName, subjectName, plansPath, errors, ignoreReadOnly) {
  const artifacts = [];
  const planNumbers = new Map();
  const entries = safeReadDir(plansPath, errors, `read plans directory ${scopeName}/${typeName}/${subjectName}/plans`);

  for (const entry of entries) {
    const entryPath = path.join(plansPath, entry.name);
    if (entry.isDirectory() && entry.name === RESOURCE_DIR_NAME) {
      continue;
    }

    if (!entry.isFile()) {
      errors.push(`Unexpected directory in plans folder: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid plan file name: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (shouldSkipReadOnlyPath(entryPath, ignoreReadOnly)) {
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = planNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate plan number ${number} in ${scopeName}/${typeName}/${subjectName}/plans: ${toDisplayPath(previous)} and ${toDisplayPath(entryPath)}`);
    } else {
      planNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Plan file name must be lowercase: ${toDisplayPath(entryPath)}`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const expectedHeader = `# ${scopeName}-plan-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Plan title must start with "${expectedHeader}": ${toDisplayPath(entryPath)}`);
    }

    lintPlanExpectedEndDate(content, entryPath, errors);
    lintDocumentLinks(entryPath, xdrsRoot, scopeName, errors);
  }

  return artifacts;
}

function lintPlanExpectedEndDate(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const expectedEndDateLines = findFieldLines(lines, ignoredLines, 'Expected end date:');

  if (expectedEndDateLines.length === 0) {
    errors.push(`Plan must include an Expected end date: field: ${toDisplayPath(filePath)}`);
    return;
  }

  if (expectedEndDateLines.length > 1) {
    errors.push(`Plan must not repeat Expected end date: ${toDisplayPath(filePath)}`);
  }

  const value = lines[expectedEndDateLines[0]].slice('Expected end date:'.length).trim().replace(/\.$/, '');
  if (!isIsoDate(value)) {
    errors.push(`Plan Expected end date: must be a valid ISO date in YYYY-MM-DD format: ${toDisplayPath(filePath)}`);
  }
}

function lintTypeIndex(indexPath, xdrsRoot, artifacts, errors) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const repoRoot = path.dirname(xdrsRoot);
  const localLinks = parseLocalLinks(content, path.dirname(indexPath), repoRoot);
  const linkedSet = new Set();
  const scopeName = path.relative(xdrsRoot, indexPath).split(path.sep)[0];
  const localScopePath = normalizePath(path.join(xdrsRoot, '_local'));

  for (const linkPath of localLinks) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in canonical index ${toDisplayPath(indexPath)}: ${displayPath(indexPath, linkPath)}`);
      continue;
    }

    if (scopeName !== '_local' && (isPathInside(localScopePath, linkPath) || normalizePath(linkPath) === localScopePath)) {
      errors.push(`Non-_local document must not link into _local scope: ${displayPath(indexPath, linkPath)}`);
    }

    linkedSet.add(normalizePath(linkPath));
  }

  for (const artifactPath of artifacts) {
    if (!linkedSet.has(normalizePath(artifactPath))) {
      errors.push(`Canonical index ${toDisplayPath(indexPath)} is missing an entry for ${toDisplayPath(artifactPath)}`);
    }
  }
}

function lintDocumentLinks(documentPath, xdrsRoot, scopeName, errors) {
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

      if (!isResourceLink && !link.isAbsolutePath) {
        const relativeToDoc = path.relative(documentDir, link.resolvedPath);
        const goesUpToParent = relativeToDoc.startsWith('..');
        if (goesUpToParent) {
          errors.push(`Relative links to parent directories must use absolute paths starting with / in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget}`);
        }
      }

      if (!fs.existsSync(link.resolvedPath)) {
        if (isResourceLink) {
          errors.push(`Broken asset link in ${toDisplayPath(documentPath)}: ${link.rawTarget}`);
        } else {
          errors.push(`Broken local link in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget}`);
        }
        continue;
      }

      if (scopeName !== '_local' && (isPathInside(localScopePath, link.resolvedPath) || normalizePath(link.resolvedPath) === localScopePath)) {
        errors.push(`Non-_local document must not link into _local scope in ${toDisplayPath(documentPath)}:${index + 1}: ${link.rawTarget}`);
      }

      if (isResourceLink && !isPathInside(resourceDir, link.resolvedPath)) {
        errors.push(`Asset links in ${toDisplayPath(documentPath)} must point to ${toDisplayPath(resourceDir)}: ${link.rawTarget}`);
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

function extractFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
  if (!match) {
    return { present: false, name: null, description: false, validFrom: undefined, appliedTo: undefined };
  }
  const block = match[1];
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  const validFromMatch = block.match(/^valid-from:\s*(.+)$/m);
  const appliedToMatch = block.match(/^applied-to:\s*(.+)$/m);
  return {
    present: true,
    name: nameMatch ? nameMatch[1].trim() || null : null,
    description: /^description:\s*\S/m.test(block),
    validFrom: validFromMatch ? validFromMatch[1].trim() : undefined,
    appliedTo: appliedToMatch ? appliedToMatch[1].trim() : undefined,
  };
}

function stripFrontmatter(content) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return match ? content.slice(match[0].length) : content;
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

function isReadOnly(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.W_OK);
    return false;
  } catch {
    return true;
  }
}

function shouldSkipReadOnlyPath(filePath, ignoreReadOnly) {
  return ignoreReadOnly && isReadOnly(filePath);
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

module.exports = {
  runLintCli,
  lintWorkspace
};

if (require.main === module) {
  process.exitCode = runLintCli(process.argv.slice(2));
}