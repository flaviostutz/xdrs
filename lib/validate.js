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
  edrs: new Set(['principles', 'application', 'infra', 'ai', 'observability', 'devops', 'governance'])
};

const TYPE_NAMES = new Set(Object.keys(TYPE_TO_ID));
const RESERVED_SCOPES = new Set(['_core', '_local']);
const NUMBERED_FILE_RE = /^(\d{3,})-([a-z0-9-]+)\.md$/;
const NUMBERED_DIR_RE = /^(\d{3,})-([a-z0-9-]+)$/;
const REQUIRED_ROOT_INDEX_TEXT = 'XDRs in scopes listed last override the ones listed first';

function runValidateCli(args) {
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return 0;
  }

  const targetPath = args[0] || '.';
  const result = validateWorkspace(targetPath);

  if (result.errors.length === 0) {
    console.log(`Validation passed for ${result.xdrsRoot}`);
    return 0;
  }

  console.error(`Validation failed for ${result.xdrsRoot}`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }

  return 1;
}

function printHelp() {
  console.log('Usage: xdrs-core validate [path]\n');
  console.log('Validate the XDR tree rooted at [path]/.xdrs or at [path] when [path] already points to .xdrs.');
  console.log('All other commands continue to be delegated to the bundled filedist CLI.');
}

function validateWorkspace(targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  const xdrsRoot = path.basename(resolvedTarget) === '.xdrs'
    ? resolvedTarget
    : path.join(resolvedTarget, '.xdrs');
  const errors = [];

  if (!existsDirectory(xdrsRoot)) {
    errors.push(`Missing XDR root directory: ${xdrsRoot}`);
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
    validateScopeDirectory(xdrsRoot, scopeEntry.name, errors, actualTypeIndexes);
  }

  const rootIndexPath = path.join(xdrsRoot, 'index.md');
  if (!existsFile(rootIndexPath)) {
    errors.push('Missing required root index: .xdrs/index.md');
  } else {
    validateRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors);
  }

  return { xdrsRoot, errors };
}

function validateRootIndex(rootIndexPath, xdrsRoot, actualTypeIndexes, errors) {
  const content = fs.readFileSync(rootIndexPath, 'utf8');

  if (!content.includes(REQUIRED_ROOT_INDEX_TEXT)) {
    errors.push(`Root index is missing required override text: ${relativeFrom(xdrsRoot, rootIndexPath)}`);
  }

  const localLinks = parseLocalLinks(content, path.dirname(rootIndexPath));
  for (const linkPath of localLinks) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in root index: ${displayPath(rootIndexPath, linkPath)}`);
    }
  }

  const linkedTypeIndexes = localLinks.filter((linkPath) => isCanonicalTypeIndex(linkPath, xdrsRoot));
  const linkedSet = new Set(linkedTypeIndexes.map(normalizePath));

  for (const indexPath of actualTypeIndexes) {
    if (!linkedSet.has(normalizePath(indexPath))) {
      errors.push(`Root index is missing canonical index link: ${relativeFrom(xdrsRoot, indexPath)}`);
    }
  }

  let seenLocal = false;
  for (const indexPath of linkedTypeIndexes) {
    const scopeName = path.basename(path.dirname(path.dirname(indexPath)));
    if (scopeName === '_local') {
      seenLocal = true;
      continue;
    }
    if (seenLocal) {
      errors.push('Root index must keep all _local scope links after every non-_local scope link');
      break;
    }
  }
}

function validateScopeDirectory(xdrsRoot, scopeName, errors, actualTypeIndexes) {
  const scopePath = path.join(xdrsRoot, scopeName);

  if (!isValidScopeName(scopeName)) {
    errors.push(`Invalid scope name: ${relativeFrom(xdrsRoot, scopePath)}`);
  }

  const entries = safeReadDir(scopePath, errors, `read scope directory ${scopeName}`);
  for (const entry of entries) {
    const entryPath = path.join(scopePath, entry.name);
    if (entry.isDirectory()) {
      if (!TYPE_NAMES.has(entry.name)) {
        errors.push(`Unexpected directory under scope ${scopeName}: ${relativeFrom(xdrsRoot, entryPath)}`);
        continue;
      }
      validateTypeDirectory(xdrsRoot, scopeName, entry.name, errors, actualTypeIndexes);
      continue;
    }

    errors.push(`Unexpected file under scope ${scopeName}: ${relativeFrom(xdrsRoot, entryPath)}`);
  }
}

function validateTypeDirectory(xdrsRoot, scopeName, typeName, errors, actualTypeIndexes) {
  const typePath = path.join(xdrsRoot, scopeName, typeName);
  const indexPath = path.join(typePath, 'index.md');
  const xdrNumbers = new Map();
  const artifacts = [];

  if (!existsFile(indexPath)) {
    errors.push(`Missing canonical index: ${relativeFrom(xdrsRoot, indexPath)}`);
  } else {
    actualTypeIndexes.push(indexPath);
  }

  const entries = safeReadDir(typePath, errors, `read type directory ${scopeName}/${typeName}`);
  for (const entry of entries) {
    const entryPath = path.join(typePath, entry.name);
    if (entry.isFile()) {
      if (entry.name !== 'index.md') {
        errors.push(`Unexpected file under ${scopeName}/${typeName}: ${relativeFrom(xdrsRoot, entryPath)}`);
      }
      continue;
    }

    if (!ALLOWED_SUBJECTS[typeName].has(entry.name)) {
      errors.push(`Invalid subject folder for ${typeName}: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    artifacts.push(...validateSubjectDirectory(xdrsRoot, scopeName, typeName, entry.name, xdrNumbers, errors));
  }

  if (existsFile(indexPath)) {
    validateTypeIndex(indexPath, xdrsRoot, artifacts, errors);
  }
}

function validateSubjectDirectory(xdrsRoot, scopeName, typeName, subjectName, xdrNumbers, errors) {
  const subjectPath = path.join(xdrsRoot, scopeName, typeName, subjectName);
  const artifacts = [];
  const entries = safeReadDir(subjectPath, errors, `read subject directory ${scopeName}/${typeName}/${subjectName}`);

  for (const entry of entries) {
    const entryPath = path.join(subjectPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'skills') {
        artifacts.push(...validateSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }
      if (entry.name === 'articles') {
        artifacts.push(...validateArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, entryPath, errors));
        continue;
      }

      errors.push(`Unexpected directory under ${scopeName}/${typeName}/${subjectName}: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    if (!NUMBERED_FILE_RE.test(entry.name)) {
      errors.push(`Invalid XDR file name: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    artifacts.push(entryPath);
    validateXdrFile(xdrsRoot, scopeName, typeName, entryPath, xdrNumbers, errors);
  }

  return artifacts;
}

function validateXdrFile(xdrsRoot, scopeName, typeName, filePath, xdrNumbers, errors) {
  const baseName = path.basename(filePath);
  const match = baseName.match(NUMBERED_FILE_RE);
  if (!match) {
    return;
  }

  const number = match[1];
  const previous = xdrNumbers.get(number);
  if (previous) {
    errors.push(`Duplicate XDR number ${number} in ${scopeName}/${typeName}: ${relativeFrom(xdrsRoot, previous)} and ${relativeFrom(xdrsRoot, filePath)}`);
  } else {
    xdrNumbers.set(number, filePath);
  }

  if (baseName !== baseName.toLowerCase()) {
    errors.push(`XDR file name must be lowercase: ${relativeFrom(xdrsRoot, filePath)}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const expectedHeader = `# ${scopeName}-${TYPE_TO_ID[typeName]}-${number}:`;
  const firstLine = firstNonEmptyLine(content);
  if (!firstLine.startsWith(expectedHeader)) {
    errors.push(`XDR title must start with "${expectedHeader}": ${relativeFrom(xdrsRoot, filePath)}`);
  }
}

function validateSkillsDirectory(xdrsRoot, scopeName, typeName, subjectName, skillsPath, errors) {
  const artifacts = [];
  const skillNumbers = new Map();
  const entries = safeReadDir(skillsPath, errors, `read skills directory ${scopeName}/${typeName}/${subjectName}/skills`);

  for (const entry of entries) {
    const entryPath = path.join(skillsPath, entry.name);
    if (!entry.isDirectory()) {
      errors.push(`Unexpected file in skills directory: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_DIR_RE);
    if (!match) {
      errors.push(`Invalid skill package name: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    const number = match[1];
    const previous = skillNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate skill number ${number} in ${scopeName}/${typeName}/${subjectName}/skills: ${relativeFrom(xdrsRoot, previous)} and ${relativeFrom(xdrsRoot, entryPath)}`);
    } else {
      skillNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Skill package name must be lowercase: ${relativeFrom(xdrsRoot, entryPath)}`);
    }

    const skillFilePath = path.join(entryPath, 'SKILL.md');
    artifacts.push(skillFilePath);

    if (!existsFile(skillFilePath)) {
      errors.push(`Missing SKILL.md in skill package: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    const skillContent = fs.readFileSync(skillFilePath, 'utf8');
    const frontmatterName = extractFrontmatterName(skillContent);
    if (!frontmatterName) {
      errors.push(`SKILL.md is missing a frontmatter name field: ${relativeFrom(xdrsRoot, skillFilePath)}`);
    } else if (frontmatterName !== entry.name) {
      errors.push(`Skill frontmatter name must match package directory "${entry.name}": ${relativeFrom(xdrsRoot, skillFilePath)}`);
    }
  }

  return artifacts;
}

function validateArticlesDirectory(xdrsRoot, scopeName, typeName, subjectName, articlesPath, errors) {
  const artifacts = [];
  const articleNumbers = new Map();
  const entries = safeReadDir(articlesPath, errors, `read articles directory ${scopeName}/${typeName}/${subjectName}/articles`);

  for (const entry of entries) {
    const entryPath = path.join(articlesPath, entry.name);
    if (!entry.isFile()) {
      errors.push(`Unexpected directory in articles folder: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    const match = entry.name.match(NUMBERED_FILE_RE);
    if (!match) {
      errors.push(`Invalid article file name: ${relativeFrom(xdrsRoot, entryPath)}`);
      continue;
    }

    artifacts.push(entryPath);

    const number = match[1];
    const previous = articleNumbers.get(number);
    if (previous) {
      errors.push(`Duplicate article number ${number} in ${scopeName}/${typeName}/${subjectName}/articles: ${relativeFrom(xdrsRoot, previous)} and ${relativeFrom(xdrsRoot, entryPath)}`);
    } else {
      articleNumbers.set(number, entryPath);
    }

    if (entry.name !== entry.name.toLowerCase()) {
      errors.push(`Article file name must be lowercase: ${relativeFrom(xdrsRoot, entryPath)}`);
    }

    const content = fs.readFileSync(entryPath, 'utf8');
    const expectedHeader = `# ${scopeName}-article-${number}:`;
    const firstLine = firstNonEmptyLine(content);
    if (!firstLine.startsWith(expectedHeader)) {
      errors.push(`Article title must start with "${expectedHeader}": ${relativeFrom(xdrsRoot, entryPath)}`);
    }
  }

  return artifacts;
}

function validateTypeIndex(indexPath, xdrsRoot, artifacts, errors) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const localLinks = parseLocalLinks(content, path.dirname(indexPath));
  const linkedSet = new Set();

  for (const linkPath of localLinks) {
    if (!fs.existsSync(linkPath)) {
      errors.push(`Broken link in canonical index ${relativeFrom(xdrsRoot, indexPath)}: ${displayPath(indexPath, linkPath)}`);
      continue;
    }

    linkedSet.add(normalizePath(linkPath));
  }

  for (const artifactPath of artifacts) {
    if (!linkedSet.has(normalizePath(artifactPath))) {
      errors.push(`Canonical index ${relativeFrom(xdrsRoot, indexPath)} is missing an entry for ${relativeFrom(xdrsRoot, artifactPath)}`);
    }
  }
}

function parseLocalLinks(markdown, baseDir) {
  const links = [];
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
  let match = linkRe.exec(markdown);
  while (match) {
    const rawTarget = match[1].trim();
    if (isLocalLink(rawTarget)) {
      const targetWithoutAnchor = rawTarget.split('#')[0];
      links.push(path.resolve(baseDir, targetWithoutAnchor));
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

function extractFrontmatterName(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const nameMatch = frontmatterMatch[1].match(/^name:\s*(.+)$/m);
  return nameMatch ? nameMatch[1].trim() : null;
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
    errors.push(`Failed to ${operation}: ${dirPath} (${error.message})`);
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
  return `${relativeFrom(process.cwd(), indexPath)} -> ${relativeFrom(path.dirname(indexPath), targetPath)}`;
}

function relativeFrom(basePath, targetPath) {
  return path.relative(basePath, targetPath) || '.';
}

function normalizePath(filePath) {
  return path.normalize(filePath);
}

module.exports = {
  runValidateCli,
  validateWorkspace
};