'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { lintWorkspace } = require('./lint');

let tmpRoot;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xdrs-core-lint-'));
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('reports broken local document links in XDR files', () => {
  const workspaceRoot = createWorkspace('broken-xdr-link', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument(`See [Missing](002-missing.md).`),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Broken local link in');
  expect(result.errors.join('\n')).toContain('002-missing.md');
});

test('ignores local links inside fenced code blocks', () => {
  const workspaceRoot = createWorkspace('ignore-code-fence', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument([
      '```markdown',
      '[Missing](002-missing.md)',
      '```'
    ].join('\n')),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Broken local link in');
});

test('reports broken local document links in skill files', () => {
  const workspaceRoot = createWorkspace('broken-skill-link', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-check-links](principles/skills/001-check-links/SKILL.md) - Check local links'
    ]),
    '.xdrs/_local/adrs/principles/skills/001-check-links/SKILL.md': skillDocument('See [Missing](missing.md).'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Broken local link in');
  expect(result.errors.join('\n')).toContain('missing.md');
});

test('skips external scopes by default and checks them when ignoreExternal is false', () => {
  const workspaceRoot = createWorkspace('external-default-skip', {
    '.xdrs/index.md': rootIndex(['[extscope](extscope/index.md)']),
    '.xdrs/extscope/index.md': '# extscope Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/extscope/adrs/index.md': [
      '# extscope ADR Index',
      '',
      'Test.',
      '',
      '## principles',
      '',
      '- [001-ext](principles/001-ext.md) - Ext decision',
      ''
    ].join('\n'),
    '.xdrs/extscope/adrs/principles/001-ext.md': [
      '---',
      'name: extscope-adr-001-ext',
      'description: External test XDR document',
      '---',
      '',
      '# extscope-adr-001: Ext decision',
      '',
      '## Context and Problem Statement',
      '',
      'See [Missing](002-missing.md).',
      ''
    ].join('\n'),
    '.filedist': '.xdrs/extscope/adrs/principles/001-ext.md|some-package|1.0.0\n',
  });

  const defaultResult = lintWorkspace(workspaceRoot);
  const allResult = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(defaultResult.errors.join('\n')).not.toContain('Broken local link in');
  expect(allResult.errors.join('\n')).toContain('Broken local link in');
});

test('skips entire external scope when only some of its files are in filedist', () => {
  const workspaceRoot = createWorkspace('external-scope-partial-filedist', {
    '.xdrs/index.md': rootIndex(['[extscope](extscope/index.md)']),
    '.xdrs/extscope/index.md': '# extscope Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/extscope/adrs/index.md': [
      '# extscope ADR Index',
      '',
      'Test.',
      '',
      '## principles',
      '',
      '- [001-ext](principles/001-ext.md) - Ext decision',
      '- [002-local](principles/002-local.md) - Local decision',
      ''
    ].join('\n'),
    '.xdrs/extscope/adrs/principles/001-ext.md': [
      '---',
      'name: extscope-adr-001-ext',
      'description: External test XDR document',
      '---',
      '',
      '# extscope-adr-001: Ext decision',
      '',
      '## Context and Problem Statement',
      '',
      'External body.',
      ''
    ].join('\n'),
    '.xdrs/extscope/adrs/principles/002-local.md': [
      '---',
      'name: extscope-adr-002-local',
      'description: Second XDR in external scope',
      '---',
      '',
      '# extscope-adr-002: Local decision',
      '',
      '## Context and Problem Statement',
      '',
      'See [Missing](003-missing.md).',
      ''
    ].join('\n'),
    '.filedist': '.xdrs/extscope/adrs/principles/001-ext.md|some-package|1.0.0\n',
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Broken local link in');
});

test('derives expected frontmatter name from the markdown heading title', () => {
  const workspaceRoot = createWorkspace('heading-name-match', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [002-scope-guidelines](principles/002-xdr-scope-guidelines.md) - Scope guidelines'
    ]),
    '.xdrs/_local/adrs/principles/002-xdr-scope-guidelines.md': [
      '---',
      'name: _local-adr-002-xdr-scope-guidelines-for-agentme',
      'description: Test XDR document',
      '---',
      '',
      '# _local-adr-002: XDR scope guidelines for agentme',
      '',
      '## Context and Problem Statement',
      '',
      'Test body.',
      ''
    ].join('\n'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).not.toContain('XDR frontmatter name must be');
});

test('reports non-_local XDR linking to _local scope document', () => {
  const workspaceRoot = createWorkspace('non-local-links-to-local-xdr', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('Local decision.'),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [001-team](principles/001-team.md) - Team decision'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument(
      'See [local doc](../../../_local/adrs/principles/001-main.md).'
    ),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).toContain('Non-_local document must not link into _local scope');
});

test('allows _local XDR linking to another _local scope document', () => {
  const workspaceRoot = createWorkspace('local-links-to-local', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision',
      '- [002-second](principles/002-second.md) - Second decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': [
      '---',
      'name: _local-adr-001-main',
      'description: Test XDR document',
      '---',
      '',
      '# _local-adr-001: Main decision',
      '',
      '## Context and Problem Statement',
      '',
      'See [second](/.xdrs/_local/adrs/principles/002-second.md).',
      ''
    ].join('\n'),
    '.xdrs/_local/adrs/principles/002-second.md': [
      '---',
      'name: _local-adr-002-second',
      'description: Second test XDR document',
      '---',
      '',
      '# _local-adr-002: Second decision',
      '',
      '## Context and Problem Statement',
      '',
      'Second body.',
      ''
    ].join('\n'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).not.toContain('Non-_local document must not link into _local scope');
  expect(result.errors.join('\n')).not.toContain('Broken local link');
});

test('reports non-_local canonical index linking to _local scope document', () => {
  const workspaceRoot = createWorkspace('non-local-type-index-links-to-local', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('Local decision.'),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [_local 001](../../_local/adrs/principles/001-main.md) - Cross-scope link'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument('Team decision.'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).toContain('Non-_local document must not link into _local scope');
});

test('reports relative non-asset links to parent directories in XDR documents', () => {
  const workspaceRoot = createWorkspace('parent-dir-relative-link-in-xdr', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See [other](../other.md).'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Relative links to parent directories must use absolute paths');
  expect(result.errors.join('\n')).toContain('../other.md');
});

test('allows child directory relative non-asset links in XDR documents', () => {
  const workspaceRoot = createWorkspace('child-dir-relative-link-in-xdr', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See [skill](skills/001-lint/SKILL.md).'),
  });
  const skillDir = path.join(workspaceRoot, '.xdrs/_local/adrs/principles/skills/001-lint');
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: 001-lint\ndescription: test skill\n---\n# Skill');

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Relative links to parent directories');
  expect(result.errors.join('\n')).not.toContain('Broken local link');
});

test('allows same-directory relative non-asset links in XDR documents', () => {
  const workspaceRoot = createWorkspace('same-dir-relative-link-in-xdr', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision',
      '- [002-other](principles/002-other.md) - Other decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See [other](002-other.md).'),
    '.xdrs/_local/adrs/principles/002-other.md': xdrDocument('Other body.').replace('_local-adr-001-main', '_local-adr-002-other').replace('# _local-adr-001: Main decision', '# _local-adr-002: Other decision'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('absolute paths');
  expect(result.errors.join('\n')).not.toContain('Broken local link');
});

test('allows relative asset links in XDR documents', () => {
  const workspaceRoot = createWorkspace('relative-asset-link', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See ![diagram](.assets/diagram.png).'),
  });
  const assetsDir = path.join(workspaceRoot, '.xdrs/_local/adrs/principles/.assets');
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, 'diagram.png'), Buffer.alloc(0));

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Non-asset links must use absolute paths');
  expect(result.errors.join('\n')).not.toContain('Broken asset link');
});

test('reports absolute path link that is broken', () => {
  const workspaceRoot = createWorkspace('broken-absolute-link', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See [missing](/.xdrs/_local/adrs/principles/999-nonexistent.md).'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Broken local link');
  expect(result.errors.join('\n')).toContain('999-nonexistent.md');
  expect(result.errors.join('\n')).not.toContain('Non-asset links must use absolute paths');
});

test('reports non-_local XDR linking to _local scope via absolute path', () => {
  const workspaceRoot = createWorkspace('abs-non-local-links-to-local', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('Local decision.'),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [001-team](principles/001-team.md) - Team decision'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument(
      'See [local doc](/.xdrs/_local/adrs/principles/001-main.md).'
    ),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).toContain('Non-_local document must not link into _local scope');
});

test('allows index.md at scope level', () => {
  const workspaceRoot = createWorkspace('scope-index-allowed', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/index.md': '# _local Scope Overview\n\nOverview of local scope.\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('Test body.'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Unexpected file under scope');
});

test('reports scope index missing link to type index', () => {
  const workspaceRoot = createWorkspace('scope-index-missing-type-link', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\nNo type links here.\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [001-team](principles/001-team.md) - Team decision'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument('Team decision.'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).toContain('Scope index');
  expect(result.errors.join('\n')).toContain('is missing link to type index');
  expect(result.errors.join('\n')).toContain('adrs/index.md');
});

test('passes when scope index links to all type indexes', () => {
  const workspaceRoot = createWorkspace('scope-index-links-all-types', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\n[ADRs](adrs/index.md)\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [001-team](principles/001-team.md) - Team decision'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument('Team decision.'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).not.toContain('is missing link to type index');
});

test('reports broken link in scope index', () => {
  const workspaceRoot = createWorkspace('scope-index-broken-link', {
    '.xdrs/index.md': rootIndex(['[myteam](myteam/index.md)']),
    '.xdrs/myteam/index.md': '# myteam Scope Overview\n\n[ADRs](adrs/index.md)\n[Missing](missing/index.md)\n',
    '.xdrs/myteam/adrs/index.md': teamAdrIndex([
      '- [001-team](principles/001-team.md) - Team decision'
    ]),
    '.xdrs/myteam/adrs/principles/001-team.md': teamXdrDocument('Team decision.'),
  });

  const result = lintWorkspace(workspaceRoot, { ignoreExternal: false });

  expect(result.errors.join('\n')).toContain('Broken link in scope index');
  expect(result.errors.join('\n')).toContain('missing/index.md');
});

test('reports missing scope index', () => {
  const workspaceRoot = createWorkspace('missing-scope-index', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('Test body.'),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Missing required scope index');
  expect(result.errors.join('\n')).toContain('_local/index.md');
});

test('reports orphan asset files not referenced by any document', () => {
  const workspaceRoot = createWorkspace('orphan-asset', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See ![used](.assets/used.png).'),
    '.xdrs/_local/adrs/principles/.assets/used.png': Buffer.alloc(0),
    '.xdrs/_local/adrs/principles/.assets/orphan.png': Buffer.alloc(0),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Orphan asset file');
  expect(result.errors.join('\n')).toContain('orphan.png');
  expect(result.errors.join('\n')).not.toContain('used.png');
});

test('does not report asset files that are referenced', () => {
  const workspaceRoot = createWorkspace('no-orphan-asset', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-main](principles/001-main.md) - Main decision'
    ]),
    '.xdrs/_local/adrs/principles/001-main.md': xdrDocument('See ![img](.assets/diagram.png).'),
    '.xdrs/_local/adrs/principles/.assets/diagram.png': Buffer.alloc(0),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).not.toContain('Orphan asset file');
});

test('reports orphan asset in articles .assets directory', () => {
  const workspaceRoot = createWorkspace('orphan-article-asset', {
    '.xdrs/index.md': rootIndex(),
    '.xdrs/_local/adrs/index.md': localAdrIndex([
      '- [001-guide](principles/articles/001-guide.md) - Guide article'
    ]),
    '.xdrs/_local/adrs/principles/articles/001-guide.md': [
      '# _local-article-001: Guide',
      '',
      'See ![used](.assets/used.png).',
      ''
    ].join('\n'),
    '.xdrs/_local/adrs/principles/articles/.assets/used.png': Buffer.alloc(0),
    '.xdrs/_local/adrs/principles/articles/.assets/unused.jpg': Buffer.alloc(0),
  });

  const result = lintWorkspace(workspaceRoot);

  expect(result.errors.join('\n')).toContain('Orphan asset file');
  expect(result.errors.join('\n')).toContain('unused.jpg');
  expect(result.errors.join('\n')).not.toContain('used.png');
});

function teamAdrIndex(entries) {
  return [
    '# myteam ADR Index',
    '',
    'Team ADRs for tests.',
    '',
    '## principles',
    '',
    ...entries,
    ''
  ].join('\n');
}

function teamXdrDocument(body) {
  return [
    '---',
    'name: myteam-adr-001-team',
    'description: Team test XDR document',
    '---',
    '',
    '# myteam-adr-001: Team decision',
    '',
    '## Context and Problem Statement',
    '',
    body,
    ''
  ].join('\n');
}

function createWorkspace(name, files) {
  const workspaceRoot = path.join(tmpRoot, name);
  fs.mkdirSync(workspaceRoot, { recursive: true });

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(workspaceRoot, relativePath);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }

  return workspaceRoot;
}

function rootIndex(extraScopeLinks) {
  const lines = [
    '# XDR Standards Index',
    '',
    '## Scope Indexes',
    '',
    'XDRs in scopes listed last override the ones listed first',
    '',
  ];
  if (extraScopeLinks) {
    lines.push(...extraScopeLinks, '');
  }
  lines.push(
    '### _local (reserved)',
    '',
    'Project-local XDRs stay in the workspace tree only.',
  );
  return lines.join('\n');
}

function localAdrIndex(entries) {
  return [
    '# _local ADR Index',
    '',
    'Local ADRs for tests.',
    '',
    '## principles',
    '',
    ...entries,
    ''
  ].join('\n');
}

function xdrDocument(body) {
  return [
    '---',
    'name: _local-adr-001-main',
    'description: Test XDR document',
    '---',
    '',
    '# _local-adr-001: Main decision',
    '',
    '## Context and Problem Statement',
    '',
    body,
    ''
  ].join('\n');
}

function skillDocument(body) {
  return [
    '---',
    'name: 001-check-links',
    'description: Test skill document',
    '---',
    '',
    '# Test skill',
    '',
    body,
    ''
  ].join('\n');
}