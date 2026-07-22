import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateImageSemanticsLocal } from '../lib/providers/local-evaluator';
import { LocalImageProvider } from '../lib/providers/local-image-provider';
import { buildLocalScreenplay } from '../lib/providers/local-script-provider';
import {
  getImageProvider,
  getProviderMode,
  isGeminiConfigured,
  shouldUseLocalProviders,
} from '../lib/providers/resolve-providers';

test('isGeminiConfigured rejects placeholders, demo keys, and short values', () => {
  assert.equal(isGeminiConfigured(undefined), false);
  assert.equal(isGeminiConfigured(''), false);
  assert.equal(isGeminiConfigured('MY_GEMINI_API_KEY'), false);
  assert.equal(isGeminiConfigured('your_gemini_api_key_here'), false);
  assert.equal(isGeminiConfigured('demo-key-12'), false);
  assert.equal(isGeminiConfigured('short'), false);
  assert.equal(isGeminiConfigured('AIzaSyDummyValidLookingKey123456'), true);
});

test('PROVIDER_MODE local forces local providers even with a configured key', () => {
  const previousMode = process.env.PROVIDER_MODE;
  const previousKey = process.env.GEMINI_API_KEY;
  try {
    process.env.PROVIDER_MODE = 'local';
    process.env.GEMINI_API_KEY = 'AIzaSyDummyValidLookingKey123456';
    assert.equal(getProviderMode(), 'local');
    assert.equal(shouldUseLocalProviders(), true);
    assert.equal(getImageProvider().providerId, 'local-dev');
  } finally {
    if (previousMode === undefined) delete process.env.PROVIDER_MODE;
    else process.env.PROVIDER_MODE = previousMode;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('PROVIDER_MODE auto uses local providers when the key is a placeholder', () => {
  const previousMode = process.env.PROVIDER_MODE;
  const previousKey = process.env.GEMINI_API_KEY;
  try {
    process.env.PROVIDER_MODE = 'auto';
    process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
    assert.equal(shouldUseLocalProviders(), true);
    assert.equal(getImageProvider().providerId, 'local-dev');
  } finally {
    if (previousMode === undefined) delete process.env.PROVIDER_MODE;
    else process.env.PROVIDER_MODE = previousMode;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('local image provider returns a 1280x720 PNG with variance', async () => {
  const provider = new LocalImageProvider();
  provider.assertConfigured();
  const images = await provider.generate({ prompt: 'A coastal night market under sodium lamps' });
  assert.equal(images.length, 1);
  assert.equal(images[0].providerId, 'local-dev');
  assert.equal(images[0].mimeType, 'image/png');
  assert.ok(images[0].bytes.length > 1000);
  assert.ok(images[0].bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));

  const sharp = (await import('sharp')).default;
  const meta = await sharp(images[0].bytes).metadata();
  assert.equal(meta.width, 1280);
  assert.equal(meta.height, 720);
});

test('local evaluator passes valid images and fails closed on empty prompt', async () => {
  const provider = new LocalImageProvider();
  const [image] = await provider.generate({ prompt: 'Warehouse interior with rim light' });
  const passed = await evaluateImageSemanticsLocal(image.bytes, image.mimeType, 'Warehouse scene', 'Compiled warehouse prompt');
  assert.equal(passed.passed, true);
  assert.equal(passed.safetyPassed, true);
  assert.ok(passed.overall >= 0.75);

  await assert.rejects(
    () => evaluateImageSemanticsLocal(image.bytes, image.mimeType, 'Warehouse scene', '   '),
    /Compiled prompt is empty/,
  );
});

test('local screenplay builder produces a valid multi-scene structure', () => {
  const screenplay = buildLocalScreenplay({
    title: 'Harbor Lights',
    logline: 'A courier races dawn across the docks.',
    genre: 'Thriller',
    targetDurationSec: 600,
    projectName: 'Cinema Lab',
    projectDescription: 'Foggy harbor at dawn',
  });
  assert.ok(screenplay.scenes.length >= 3);
  assert.equal(screenplay.genre, 'Thriller');
  assert.match(screenplay.logline, /courier/i);
  for (const scene of screenplay.scenes) {
    assert.ok(scene.durationSec >= 10);
    assert.ok(scene.narration.length >= 8);
    assert.ok(scene.visualIntention.length >= 8);
  }
  const total = screenplay.scenes.reduce((sum, scene) => sum + scene.durationSec, 0);
  assert.equal(total, 600);
});
