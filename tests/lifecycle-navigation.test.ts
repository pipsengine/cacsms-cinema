import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIFECYCLE_STAGES,
  findActiveLifecyclePage,
  findStageForPathname,
  isStageOverviewActive,
  matchesPageRoute,
  pageCount,
} from '../apps/web/config/lifecycle-navigation';

test('lifecycle config exposes eight stages with page counts', () => {
  assert.equal(LIFECYCLE_STAGES.length, 8);
  assert.equal(pageCount(LIFECYCLE_STAGES[0]), 8);
  assert.equal(pageCount(LIFECYCLE_STAGES[1]), 11);
  assert.equal(pageCount(LIFECYCLE_STAGES[2]), 10);
  assert.equal(pageCount(LIFECYCLE_STAGES[3]), 11);
  assert.equal(pageCount(LIFECYCLE_STAGES[4]), 10);
  assert.equal(pageCount(LIFECYCLE_STAGES[5]), 13);
  assert.equal(pageCount(LIFECYCLE_STAGES[6]), 11);
  assert.equal(pageCount(LIFECYCLE_STAGES[7]), 13);
});

test('every stage overview opens its configured overview route', () => {
  for (const stage of LIFECYCLE_STAGES) {
    const active = findActiveLifecyclePage(stage.overviewHref);
    assert.ok(active);
    assert.equal(active?.stage.id, stage.id);
    assert.equal(active?.page.href, stage.overviewHref);
    assert.equal(isStageOverviewActive(stage.overviewHref, stage), true);
  }
});

test('nested static pages open the correct stage and page', () => {
  const samples = [
    ['/visuals/discover/project-intake', 'discover', 'Project Intake'],
    ['/visuals/research/workspace', 'research', 'Research Workspace'],
    ['/storyboard/storyboard-editor', 'scene-planning', 'Storyboard Workspace'],
    ['/visuals/image-generator', 'generation', 'Image Generator Workspace'],
    ['/visuals/quality/evidence', 'quality', 'Quality Evidence'],
    ['/visuals/delivery/video-readiness', 'delivery', 'Image-to-Video Readiness'],
    ['/visuals/learning/benchmarks', 'learning', 'Benchmark Studio'],
  ] as const;

  for (const [path, stageId, label] of samples) {
    const active = findActiveLifecyclePage(path);
    assert.ok(active, path);
    assert.equal(active?.stage.id, stageId);
    assert.equal(active?.page.label, label);
  }
});

test('child page does not highlight stage overview', () => {
  const stage = LIFECYCLE_STAGES.find((item) => item.id === 'discover')!;
  assert.equal(isStageOverviewActive('/visuals/discover/project-intake', stage), false);
  const active = findActiveLifecyclePage('/visuals/discover/project-intake');
  assert.equal(active?.page.exact ?? false, false);
  assert.notEqual(active?.page.href, stage.overviewHref);
});

test('dynamic job routes activate Generate & Validate', () => {
  const active = findActiveLifecyclePage('/visuals/generation/jobs/abc-123');
  assert.equal(active?.stage.id, 'generation');
  assert.equal(active?.page.dynamicKind, 'job');
});

test('dynamic asset routes activate Approve & Deliver', () => {
  const active = findActiveLifecyclePage('/visuals/delivery/assets/asset-9');
  assert.equal(active?.stage.id, 'delivery');
  assert.equal(active?.page.dynamicKind, 'asset');
});

test('storyboard workspace activates Scene & Cinematography', () => {
  assert.equal(findStageForPathname('/storyboard/storyboard-editor')?.id, 'scene-planning');
});

test('image generator activates Generate & Validate', () => {
  assert.equal(findStageForPathname('/visuals/image-generator')?.id, 'generation');
});

test('exact overview matching rejects descendants for overview page.exact', () => {
  const overview = LIFECYCLE_STAGES[0].pages[0];
  assert.equal(matchesPageRoute('/visuals/discover', overview), true);
  assert.equal(matchesPageRoute('/visuals/discover/project-intake', overview), false);
});

test('all configured hrefs are unique except intentional shared live workspaces', () => {
  const hrefs = LIFECYCLE_STAGES.flatMap((stage) => stage.pages.map((page) => page.href));
  assert.equal(new Set(hrefs).size, hrefs.length);
});

test('lifecycle strip stage selection maps to overview routes', () => {
  for (const stage of LIFECYCLE_STAGES) {
    assert.equal(findStageForPathname(stage.overviewHref)?.id, stage.id);
  }
});

test('permission-ready metadata is present on every stage and page', () => {
  for (const stage of LIFECYCLE_STAGES) {
    assert.ok(stage.permissionKey.startsWith('lifecycle.stage.'));
    for (const page of stage.pages) {
      assert.ok(page.permissionKey.length > 0);
      assert.ok(page.order >= 1);
      assert.ok(page.description.length > 0);
      assert.ok(page.icon.length > 0);
    }
  }
});
