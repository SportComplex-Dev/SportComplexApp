import test from 'node:test'
import assert from 'node:assert/strict'
import { ServiceSelector } from './ServiceSelector'

test('ServiceSelector component is defined and exported as a function', () => {
  assert.equal(typeof ServiceSelector, 'function')
})
