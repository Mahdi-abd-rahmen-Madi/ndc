import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { validateImageFile } from '../utils/imageUpload';

function makeFakeFile(type: string, size: number): File {
  return { type, size, name: 'test' } as unknown as File;
}

describe('imageUpload validation', () => {
  it('accepts valid PNG and JPEG files up to 10 MB', () => {
    assert.equal(validateImageFile(makeFakeFile('image/png', 500_000)), null);
    assert.equal(validateImageFile(makeFakeFile('image/jpeg', 10 * 1024 * 1024)), null);
  });

  it('rejects disallowed MIME types and oversized files', () => {
    assert.ok(validateImageFile(makeFakeFile('image/svg+xml', 1024)));
    assert.ok(validateImageFile(makeFakeFile('application/pdf', 1024)));
    assert.ok(validateImageFile(makeFakeFile('image/png', 10 * 1024 * 1024 + 1)));
  });
});

