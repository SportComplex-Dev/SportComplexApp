import test from 'node:test'
import assert from 'node:assert/strict'
import { resetPublicCatalogCache } from './usePublicCatalog'

test('resetPublicCatalogCache can be called without error', () => {
  assert.doesNotThrow(() => {
    resetPublicCatalogCache()
  })
})
