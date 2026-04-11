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
const RESOURCE_DIR_NAME = 'assets';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp']);

function runLintCli(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const targetPath = args[0] || '.';
  const result = lintWorkspace(targetPath);

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
  console.log('Usage: xdrs-core lint [path]\n');
  console.log('Lint the XDR tree rooted at [path]/.xdrs or at [path] when [path] already points to .xdrs.');
  console.log('All other commands continue to be delegated to the bundled filedist CLI.');
}

function lintWorkspace(targetPath) {
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
    lintScopeDirectory(xdrsRoot, scopeEntry.name, errors, actualTypeIndexes);
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

  if (!content.includes(REQUIRED_ROOT_INDEX_TEXT)) {
    errors.push(`Root index is missing required override text: ${toDisplayPath(rootIndexPath)}`);
  }

  const links = parseLocalLinks(content, path.dirname(rootIndexPath));
  for (const linkPath of links) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in root index: ${displayPath(rootIndexPath, linkPath)}`);
    }
  }

  const linkedTypeIndexes = links.filter((linkPath) => isCanonicalTypeIndex(linkPath, xdrsRoot));
  const linkedSet = new Set(linkedTypeIndexes.map(normalizePath));

  for (const indexPath of linkedTypeIndexes) {
    const scopeName = path.basename(path.dirname(path.dirname(indexPath)));
    if (scopeName === '_local') {
      errors.push(`Root index must not link _local canonical index: ${displayPath(rootIndexPath, indexPath)}`);
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

function lintScopeDirectory(xdrsRoot, scopeName, errors, actualTypeIndexes) {
  const scopePath = path.join(xdrsRoot, scopeName);

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
      lintTypeDirectory(xdrsRoot, scopeName, entry.name, errors, actualTypeIndexes);
      continue;
    }

    errors.push(`Unexpected file under scope ${scopeName}: ${toDisplayPath(entryPath)}`);
  }
}

function lintTypeDirectory(xdrsRoot, scopeName, typeName, errors, actualTypeIndexes) {
  const typePath = path.join(xdrsRoot, scopeName, typeName);
  const indexPath = path.join(typePath, 'index.md');
  const xdrNumbers = new Map();
  const artifacts = [];

  if (!existsFile(indexPath)) {
    errors.push(`Missing canonical index: ${toDisplayPath(indexPath)}`);
  } else {
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

    artifacts.push(...lintSubjectDirectory(xdrsRoot, scopeName, typeName, entry.name, xdrNumbers, errors));
  }

  if (existsFile(indexPath)) {
    lintTypeIndex(indexPath, xdrsRoot, artifacts, errors);
  }
}

function lintSubjectDirectory(xdrsRoot, scopeName, typeName, subjectName, xdrNumbers, errors) {
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
        artifacts.push(...lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }
      if (entry.name === 'articles') {
        artifacts.push(...lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }
      if (entry.name === 'researches') {
        artifacts.push(...lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }
      if (entry.name === 'plans') {
        artifacts.push(...lintPlansDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }

      errors.push(`Unexpected directory under ${scopeName}/${typeName}/${subjectName}: ${toDisplayPath(entryPath)}`);
      continue;
    }

    if (!NUMBERED_FILE_RE.test(entry.name)) {
      errors.push(`Invalid XDR file name: ${toDisplayPath(entryPath)}`);
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
  const firstLine = firstNonEmptyLine(content);
  if (!firstLine.startsWith(expectedHeader)) {
    errors.push(`XDR title must start with "${expectedHeader}": ${toDisplayPath(filePath)}`);
  }

  lintXdrMetadata(content, filePath, errors);
  lintDocumentResourceLinks(filePath, errors);
}

function lintXdrMetadata(content, filePath, errors) {
  const lines = content.split(/\r?\n/);
  const ignoredLines = findIgnoredMarkdownLines(lines);
  const metadataLine = findHeadingLine(lines, ignoredLines, '## Metadata');
  const contextLine = findHeadingLine(lines, ignoredLines, '## Context and Problem Statement');
  const headingLines = findHeadingLines(lines, ignoredLines);

  if (metadataLine !== -1) {
    const nextHeadingLine = headingLines.find((lineIndex) => lineIndex > metadataLine);
    if (nextHeadingLine !== contextLine) {
      errors.push(`XDR metadata section must appear immediately before Context and Problem Statement: ${toDisplayPath(filePath)}`);
    }
  }

  if (metadataLine !== -1 && contextLine !== -1 && metadataLine > contextLine) {
    errors.push(`XDR metadata section must appear before Context and Problem Statement: ${toDisplayPath(filePath)}`);
  }

  const metadataRange = metadataLine === -1
    ? null
    : {
        start: metadataLine + 1,
        end: (headingLines.find((lineIndex) => lineIndex > metadataLine) ?? lines.length) - 1
      };
  const appliedLineNumbers = findFieldLines(lines, ignoredLines, 'Applied to:');
  const validLineNumbers = findFieldLines(lines, ignoredLines, 'Valid:');

  if (!metadataRange && (appliedLineNumbers.length > 0 || validLineNumbers.length > 0)) {
    errors.push(`XDR metadata fields require a ## Metadata section immediately before Context and Problem Statement: ${toDisplayPath(filePath)}`);
    return;
  }

  if (!metadataRange) {
    return;
  }

  const metadataApplied = appliedLineNumbers.filter((lineIndex) => isLineInsideRange(lineIndex, metadataRange));
  const metadataValid = validLineNumbers.filter((lineIndex) => isLineInsideRange(lineIndex, metadataRange));

  if (metadataApplied.length === 0 && metadataValid.length === 0) {
    errors.push(`XDR metadata section must be omitted when no metadata fields are defined: ${toDisplayPath(filePath)}`);
  }

  if (metadataApplied.length > 1) {
    errors.push(`XDR metadata must not repeat Applied to: ${toDisplayPath(filePath)}`);
  }

  if (metadataValid.length > 1) {
    errors.push(`XDR metadata must not repeat Valid: ${toDisplayPath(filePath)}`);
  }

  for (const lineIndex of [...appliedLineNumbers, ...validLineNumbers]) {
    if (!isLineInsideRange(lineIndex, metadataRange)) {
      errors.push(`XDR metadata fields must be declared inside ## Metadata: ${toDisplayPath(filePath)}`);
      break;
    }
  }

  let previousFieldOrder = -1;
  for (let lineIndex = metadataRange.start; lineIndex <= metadataRange.end; lineIndex += 1) {
    if (ignoredLines[lineIndex]) {
      continue;
    }
    const trimmed = lines[lineIndex].trim();
    if (trimmed === '') {
      continue;
    }
    const currentFieldOrder = trimmed.startsWith('Valid:')
      ? 0
      : trimmed.startsWith('Applied to:')
        ? 1
        : -1;
    if (currentFieldOrder === -1) {
      errors.push(`XDR metadata section only supports Valid: and Applied to: fields: ${toDisplayPath(filePath)}`);
      break;
    }
    if (currentFieldOrder < previousFieldOrder) {
      errors.push(`XDR metadata fields must be ordered as Valid:, Applied to: ${toDisplayPath(filePath)}`);
      break;
    }
    previousFieldOrder = currentFieldOrder;
  }

  if (metadataApplied.length === 1) {
    const value = lines[metadataApplied[0]].slice('Applied to:'.length).trim();
    if (value === '') {
      errors.push(`XDR Applied to: must not be empty: ${toDisplayPath(filePath)}`);
    } else if (countWords(value) >= 40) {
      errors.push(`XDR Applied to: must be under 40 words: ${toDisplayPath(filePath)}`);
    }
  }

  if (metadataValid.length === 1) {
    lintValidField(lines[metadataValid[0]], filePath, errors);
  }
}

function lintValidField(line, filePath, errors) {
  const value = line.slice('Valid:'.length).trim().replace(/\.$/, '');

  const validMatch = value.match(/^from\s+(\d{4}-\d{2}-\d{2})$/);
  if (!validMatch) {
    errors.push(`XDR Valid: must be from YYYY-MM-DD: ${toDisplayPath(filePath)}`);
    return;
  }

  const fromDate = validMatch[1];
  if (!isIsoDate(fromDate)) {
    errors.push(`XDR Valid: must use ISO dates in YYYY-MM-DD format: ${toDisplayPath(filePath)}`);
  }
}

function lintSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, skillsPath, errors) {
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
    artifacts.push(skillFilePath);

    if (!existsFile(skillFilePath)) {
      errors.push(`Missing SKILL.md in skill package: ${toDisplayPath(entryPath)}`);
      continue;
    }

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');
    const frontmatterName = extractFrontmatterName(skillContent);
    if (!frontmatterName) {
      errors.push(`SKILL.md is missing a frontmatter name field: ${toDisplayPath(skillFilePath)}`);
    } else if (frontmatterName !== entry.name) {
      errors.push(`Skill frontmatter name must match package directory "${entry.name}": ${toDisplayPath(skillFilePath)}`);
    }

    lintDocumentResourceLinks(skillFilePath, errors);
  }

  return artifacts;
}

function lintArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, articlesPath, errors) {
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

    lintDocumentResourceLinks(entryPath, errors);
  }

  return artifacts;
}

function lintResearchDirectory(xdrsRoot, scopeName, typeName, subjectName, researchPath, errors) {
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

    lintDocumentResourceLinks(entryPath, errors);
  }

  return artifacts;
}

function lintPlansDirectory(xdrsRoot, scopeName, typeName, subjectName, plansPath, errors) {
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
    lintDocumentResourceLinks(entryPath, errors);
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
  const localLinks = parseLocalLinks(content, path.dirname(indexPath));
  const linkedSet = new Set();

  for (const linkPath of localLinks) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in canonical index ${toDisplayPath(indexPath)}: ${displayPath(indexPath, linkPath)}`);
      continue;
    }

    linkedSet.add(normalizePath(linkPath));
  }

  for (const artifactPath of artifacts) {
    if (!linkedSet.has(normalizePath(artifactPath))) {
      errors.push(`Canonical index ${toDisplayPath(indexPath)} is missing an entry for ${toDisplayPath(artifactPath)}`);
    }
  }
}

function lintDocumentResourceLinks(documentPath, errors) {
  const content = fs.readFileSync(documentPath, 'utf8');
  const documentDir = path.dirname(documentPath);
  const resourceDir = path.join(documentDir, RESOURCE_DIR_NAME);

  for (const link of parseLocalLinkTargets(content, documentDir)) {
    if (!shouldValidateResourceLink(link.rawTarget)) {
      continue;
    }

    if (!fs.existsSync(link.resolvedPath)) {
      errors.push(`Broken asset link in ${toDisplayPath(documentPath)}: ${link.rawTarget}`);
      continue;
    }

    if (!isPathInside(resourceDir, link.resolvedPath)) {
      errors.push(`Asset links in ${toDisplayPath(documentPath)} must point to ${toDisplayPath(resourceDir)}: ${link.rawTarget}`);
    }
  }
}

function parseLocalLinks(markdown, baseDir) {
  return parseLocalLinkTargets(markdown, baseDir).map((link) => link.resolvedPath);
}

function parseLocalLinkTargets(markdown, baseDir) {
  const links = [];
  const linkRe = /!?\[[^\]]+\]\(([^)]+)\)/g;
  let match = linkRe.exec(markdown);
  while (match) {
    const rawTarget = match[1].trim();
    if (isLocalLink(rawTarget)) {
      const targetWithoutAnchor = rawTarget.split('#')[0];
      links.push({
        rawTarget,
        resolvedPath: path.resolve(baseDir, targetWithoutAnchor)
      });
    }
    match = linkRe.exec(markdown);
  }
  return links;
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
  const targetWithoutAnchor = rawTarget.split('#')[0];
  const normalizedTarget = targetWithoutAnchor.replace(/\\/g, '/');
  const extension = path.extname(targetWithoutAnchor).toLowerCase();

  return normalizedTarget === RESOURCE_DIR_NAME
    || normalizedTarget.startsWith(`${RESOURCE_DIR_NAME}/`)
    || normalizedTarget.includes(`/${RESOURCE_DIR_NAME}/`)
    || IMAGE_EXTENSIONS.has(extension);
}

function extractFrontmatterName(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
  return nameMatch ? nameMatch[1].trim() : null;
}

function findIgnoredMarkdownLines(lines) {
  const ignored = [];
  let inCodeFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (/^```/.test(trimmed)) {
      ignored[index] = true;
      inCodeFence = !inCodeFence;
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