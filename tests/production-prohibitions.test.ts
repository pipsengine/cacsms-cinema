import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const productionFiles = [
  'app/api/jobs/[jobId]/candidates/route.ts',
  'app/visuals/image-generator/page.tsx',
  'lib/job-orchestrator.ts',
];

test('production generation paths contain no random, stock, or placeholder success fallbacks', () => {
  const prohibited = [/Math\.random\s*\(/, /picsum\.photos/i, /via\.placeholder/i, /status:\s*['"]SUCCESS['"][\s\S]*setTimeout/];
  for (const relativePath of productionFiles) {
    const source = readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    for (const pattern of prohibited) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains prohibited production behavior`);
    }
  }
});
