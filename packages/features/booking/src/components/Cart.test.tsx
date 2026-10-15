import test from 'node:test'
import assert from 'node:assert/strict'
import { Cart } from './Cart'

test('Cart component is defined and exported as a function', () => {
  assert.equal(typeof Cart, 'function')
})
