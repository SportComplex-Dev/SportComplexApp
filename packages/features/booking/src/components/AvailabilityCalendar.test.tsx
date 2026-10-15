import test from 'node:test'
import assert from 'node:assert/strict'
import { AvailabilityCalendar } from './AvailabilityCalendar'

test('AvailabilityCalendar component is defined and exported as a function', () => {
  assert.equal(typeof AvailabilityCalendar, 'function')
})
