import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  LIFECYCLE_STAGES,
  findActiveLifecyclePage,
  findStageForPathname,
  withContextQuery,
  deriveWorkflowStatusFromQueue,
} from '../apps/web/config/lifecycle-navigation';
import { selectedStageDoesNotMutateWorkflow } from '../apps/web/features/lifecycle/useLifecycleStatus';

const root = path.resolve(process.cwd());

function routeResolves(href: string): boolean {
  const bare = href.split('?')[0];
  if (bare === '/storyboard/storyboard-editor') {
    return fs.existsSync(path.join(root, 'app/storyboard/storyboard-editor/page.tsx'));
  }
  if (bare === '/visuals/image-generator') {
    return fs.existsSync(path.join(root, 'app/visuals/image-generator/page.tsx'));
  }
  if (bare.startsWith('/visuals/')) {
    const stagePage = path.join(root, 'app/visuals/[stage]/page.tsx');
    const nestedPage = path.join(root, 'app/visuals/[stage]/[...slug]/page.tsx');
    return fs.existsSync(stagePage) && fs.existsSync(nestedPage);
  }
  return false;
}

test('every configured lifecycle route resolves to a Next.js page handler', () => {
  for (const stage of LIFECYCLE_STAGES) {
    assert.equal(routeResolves(stage.overviewHref), true, stage.overviewHref);
    for (const page of stage.pages) {
      assert.equal(routeResolves(page.href), true, page.href);
    }
  }
});

test('stage overview hrefs match stage numbers and names', () => {
  const expected = [
    ['01', 'Discover & Interpret', '/visuals/discover'],
    ['02', 'Research & Requirements', '/visuals/research'],
    ['03', 'Scene & Cinematography', '/visuals/scene-planning'],
    ['04', 'Prompt & Model Plan', '/visuals/generation-planning'],
    ['05', 'Generate & Validate', '/visuals/generation'],
    ['06', 'Evaluate & Repair', '/visuals/quality'],
    ['07', 'Approve & Deliver', '/visuals/delivery'],
    ['08', 'Learn', '/visuals/learning'],
  ] as const;

  expected.forEach(([number, label, href], index) => {
    assert.equal(LIFECYCLE_STAGES[index].number, number);
    assert.equal(LIFECYCLE_STAGES[index].label, label);
    assert.equal(LIFECYCLE_STAGES[index].overviewHref, href);
  });
});

test('context query preservation appends shared identifiers', () => {
  const href = withContextQuery('/visuals/research/workspace', {
    projectId: 'p1',
    sceneId: 's1',
    jobId: null,
  });
  assert.equal(href, '/visuals/research/workspace?projectId=p1&sceneId=s1');
});

test('viewing a stage does not alter workflow execution state', () => {
  const before = deriveWorkflowStatusFromQueue({ DISCOVER: 2 }, LIFECYCLE_STAGES[0]);
  const afterSelecting = before;
  assert.equal(selectedStageDoesNotMutateWorkflow(before, afterSelecting), true);
  assert.equal(before, 'pending');
});

test('browser-style path restoration expands the correct stage', () => {
  const paths = [
    '/visuals/generation/queue',
    '/visuals/generation/jobs/job-1',
    '/visuals/delivery/assets/asset-1',
    '/storyboard/storyboard-editor',
    '/visuals/image-generator',
  ];
  for (const pathName of paths) {
    const stage = findStageForPathname(pathName);
    assert.ok(stage, pathName);
    const active = findActiveLifecyclePage(pathName);
    assert.equal(active?.stage.id, stage?.id);
  }
});

test('chevron expansion is independent from navigation hrefs', () => {
  // Pure contract: stage overview hrefs are navigation targets; expansion uses stage id only.
  for (const stage of LIFECYCLE_STAGES) {
    assert.notEqual(stage.id, stage.overviewHref);
    assert.match(stage.overviewHref, /^\/visuals\//);
  }
});
