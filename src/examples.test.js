import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { BVHLoader } from 'three/addons/loaders/BVHLoader.js';
import { generate, parse as dslParse } from './dsl.js';
import { create } from './clipLibrary.js';
import { parse as hdslParse, expand } from './hdsl.js';
import { examples } from './examples.js';

// Load real BVH data
const bvhText = fs.readFileSync(
  path.resolve(__dirname, '../public/assets/pirouette.bvh'),
  'utf-8'
);
const loader = new BVHLoader();
const bvh = loader.parse(bvhText);
bvh.skeleton.bones[0].updateMatrixWorld(true);

// Build clip library with pirouette registered
const lowDslText = generate(bvh.skeleton, bvh.clip, 1 / 30);
const lowParsed = dslParse(lowDslText);

function makeLib() {
  const lib = create();
  lib.register('pirouette', lowParsed);
  return lib;
}

describe('examples', () => {
  it('exports a non-empty array', () => {
    expect(Array.isArray(examples)).toBe(true);
    expect(examples.length).toBeGreaterThan(0);
  });

  it('every example has id, title, script fields', () => {
    for (const ex of examples) {
      expect(typeof ex.id).toBe('string');
      expect(ex.id.length).toBeGreaterThan(0);
      expect(typeof ex.title).toBe('string');
      expect(ex.title.length).toBeGreaterThan(0);
      expect(typeof ex.script).toBe('string');
      expect(ex.script.length).toBeGreaterThan(0);
    }
  });

  it('all ids are unique', () => {
    const ids = examples.map(ex => ex.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every example only references pirouette source', () => {
    for (const ex of examples) {
      const parsed = hdslParse(ex.script);
      for (const src of parsed.sources) {
        expect(src).toBe('pirouette');
      }
    }
  });

  for (const ex of examples) {
    describe(`"${ex.title}" (${ex.id})`, () => {
      it('parses with bpm > 0 and non-empty sequence', () => {
        const parsed = hdslParse(ex.script);
        expect(parsed.bpm).toBeGreaterThan(0);
        expect(parsed.sequence.length).toBeGreaterThan(0);
      });

      it('expands to valid low-level DSL with duration > 0 and keyframes', () => {
        const parsed = hdslParse(ex.script);
        const lib = makeLib();
        const lowDsl = expand(parsed, lib);
        const lowLevel = dslParse(lowDsl);
        expect(lowLevel.duration).toBeGreaterThan(0);
        expect(lowLevel.keyframes.length).toBeGreaterThan(0);
      });
    });
  }
});
