import test from 'node:test'
import assert from 'node:assert/strict'
import { BookingSummaryModal } from './BookingSummaryModal'

test('BookingSummaryModal component is defined and exported as a function', () => {
  assert.equal(typeof BookingSummaryModal, 'function')
})
