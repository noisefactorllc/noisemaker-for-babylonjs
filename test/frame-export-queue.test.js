import assert from 'node:assert/strict'
import test from 'node:test'

import { FrameExportQueue } from '../src/index.js'

class FakeAdapter {
  constructor () {
    this.slots = []
    this.createErrorForIndex = null
    this.beginErrorForTexture = null
    this.pollErrorForIndex = null
    this.pollResultForIndex = new Map()
    this.readErrorForIndex = null
    this.destroyErrorForIndex = null
  }

  createSlot (index, descriptor) {
    if (index === this.createErrorForIndex) throw new Error(`create ${index} failed`)
    const slot = { index, descriptor, ready: false, frame: null, destroys: 0 }
    this.slots.push(slot)
    return slot
  }

  begin (slot, textureId, timestamp) {
    if (textureId === this.beginErrorForTexture) throw new Error('begin failed')
    Object.assign(slot, { textureId, timestamp, ready: false, frame: null })
  }

  poll (slot) {
    if (slot.index === this.pollErrorForIndex) throw new Error('poll failed')
    if (this.pollResultForIndex.has(slot.index)) return this.pollResultForIndex.get(slot.index)
    return slot.ready
  }

  read (slot) {
    if (slot.index === this.readErrorForIndex) throw new Error('read failed')
    return slot.frame
  }

  destroySlot (slot) {
    slot.destroys++
    if (slot.index === this.destroyErrorForIndex) throw new Error(`destroy ${slot.index} failed`)
  }

  complete (index, frame) {
    Object.assign(this.slots[index], { frame, ready: true })
  }
}

test('FrameExportQueue validates adapters and the bounded slot count', () => {
  assert.throws(() => new FrameExportQueue({}), TypeError)
  for (const method of ['createSlot', 'begin', 'poll', 'read', 'destroySlot']) {
    const malformed = new FakeAdapter()
    malformed[method] = null
    assert.throws(() => new FrameExportQueue(malformed), TypeError)
  }
  assert.throws(() => new FrameExportQueue(new FakeAdapter(), { slots: 1 }), RangeError)
  assert.throws(() => new FrameExportQueue(new FakeAdapter(), { slots: 9 }), RangeError)
  assert.throws(() => new FrameExportQueue(new FakeAdapter(), { slots: 2.5 }), RangeError)
})

test('FrameExportQueue reconfigures reusable slots and rolls back partial allocation', () => {
  const adapter = new FakeAdapter()
  const errors = []
  const queue = new FrameExportQueue(adapter, { slots: 3, onError: error => errors.push(error.message) })
  const first = { width: 4, height: 4 }
  const second = { width: 8, height: 8 }

  queue.configure(first)
  assert.equal(queue.available, true)
  assert.deepEqual(adapter.slots.map(slot => slot.descriptor), [first, first, first])
  queue.configure(second)
  assert.deepEqual(adapter.slots.slice(0, 3).map(slot => slot.destroys), [1, 1, 1])
  assert.deepEqual(adapter.slots.slice(3).map(slot => slot.descriptor), [second, second, second])

  const rollbackAdapter = new FakeAdapter()
  const rollbackQueue = new FrameExportQueue(rollbackAdapter, { slots: 3, onError: error => errors.push(error.message) })
  rollbackAdapter.createErrorForIndex = 1
  rollbackAdapter.destroyErrorForIndex = 0
  assert.throws(() => rollbackQueue.configure(first), /create 1 failed/)
  assert.deepEqual(errors, ['destroy 0 failed'])
  assert.equal(rollbackQueue.available, false)
  assert.equal(rollbackQueue.stats.dropped, 0)
  assert.equal(rollbackQueue._slots.every(record => !record.created && record.adapterSlot === null), true)
})

test('FrameExportQueue drops on saturation, preserves context, and reuses completed slots', () => {
  const adapter = new FakeAdapter()
  const queue = new FrameExportQueue(adapter, { slots: 2 })
  const context = { sequence: 42 }
  const frames = []

  assert.equal(queue.enqueue('unconfigured', 0, () => {}), false)
  queue.configure({ width: 4, height: 4 })
  assert.throws(() => queue.enqueue('invalid', 1, null), TypeError)
  assert.equal(queue.enqueue('first', 10, (frame, timestamp, value) => frames.push([frame, timestamp, value]), context), true)
  assert.equal(queue.enqueue('second', 20, () => {}), true)
  assert.equal(queue.enqueue('third', 30, () => {}), false)
  assert.equal(queue.available, false)

  adapter.complete(0, 'frame-one')
  queue.poll()
  assert.deepEqual(frames, [['frame-one', 10, context]])
  assert.equal(queue.available, true)
  assert.equal(queue.enqueue('replacement', 40, () => {}), true)
  assert.deepEqual(queue.stats, { accepted: 3, dropped: 2, completed: 1, failed: 0 })
})

test('FrameExportQueue isolates adapter and callback failures while later slots progress', () => {
  const adapter = new FakeAdapter()
  const errors = []
  const frames = []
  const queue = new FrameExportQueue(adapter, {
    slots: 2,
    onError (error) {
      errors.push(error.message)
      if (error.message === 'begin failed') throw new Error('reporter failed')
    }
  })
  queue.configure({ width: 4, height: 4 })

  adapter.beginErrorForTexture = 'bad'
  assert.equal(queue.enqueue('bad', 1, () => {}), false)
  assert.equal(queue.enqueue('first', 10, () => { throw new Error('callback failed') }), true)
  assert.equal(queue.enqueue('second', 20, frame => frames.push(frame)), true)
  adapter.complete(0, 'discarded')
  adapter.complete(1, 'kept')
  adapter.readErrorForIndex = 0
  queue.poll()

  assert.deepEqual(errors, ['begin failed', 'read failed'])
  assert.deepEqual(frames, ['kept'])
  assert.deepEqual(queue.stats, { accepted: 2, dropped: 0, completed: 1, failed: 2 })

  adapter.readErrorForIndex = null
  assert.equal(queue.enqueue('invalid-ready', 30, () => {}), true)
  adapter.pollResultForIndex.set(0, 'ready')
  queue.poll()
  assert.equal(errors.at(-1), 'Frame export adapter poll must return a boolean')
  assert.equal(queue.stats.failed, 3)
})

test('FrameExportQueue reconfiguration drops only pending accepted frames before replacing slots', () => {
  const adapter = new FakeAdapter()
  const queue = new FrameExportQueue(adapter, { slots: 2 })
  queue.configure({ width: 4, height: 4 })
  queue.enqueue('completed', 10, () => {})
  queue.enqueue('canceled', 20, () => assert.fail('reconfigured queue delivered a canceled callback'))
  adapter.complete(0, 'frame')
  queue.poll()

  queue.configure({ width: 8, height: 8 })

  assert.deepEqual(queue.stats, { accepted: 2, dropped: 1, completed: 1, failed: 0 })
  assert.equal(queue.stats.accepted,
    queue.stats.completed + queue.stats.failed + queue.stats.dropped)
  assert.equal(queue.available, true)
  assert.equal(queue.enqueue('replacement', 30, () => {}), true)
})

test('FrameExportQueue close destroys every slot once and backendLost abandons GPU state', () => {
  const adapter = new FakeAdapter()
  const queue = new FrameExportQueue(adapter, { slots: 2 })
  queue.configure({ width: 4, height: 4 })
  queue.enqueue('first', 1, () => assert.fail('closed queue delivered a callback'))
  adapter.destroyErrorForIndex = 0

  assert.throws(() => queue.close(), /destroy 0 failed/)
  queue.close()
  assert.deepEqual(adapter.slots.map(slot => slot.destroys), [1, 1])
  assert.equal(queue.adapter, null)
  assert.equal(queue.available, false)
  assert.deepEqual(queue.stats, { accepted: 1, dropped: 1, completed: 0, failed: 0 })
  assert.equal(queue.stats.accepted,
    queue.stats.completed + queue.stats.failed + queue.stats.dropped)
  assert.equal(queue.enqueue('later', 2, () => {}), false)
  assert.deepEqual(queue.stats, { accepted: 1, dropped: 2, completed: 0, failed: 0 })

  const lostAdapter = new FakeAdapter()
  const lostQueue = new FrameExportQueue(lostAdapter, { slots: 2 })
  lostQueue.configure({ width: 4, height: 4 })
  lostQueue.enqueue('pending', 1, () => assert.fail('abandoned queue delivered a callback'))
  lostQueue.close({ backendLost: true })
  assert.deepEqual(lostAdapter.slots.map(slot => slot.destroys), [0, 0])
  assert.equal(lostQueue.adapter, null)
  assert.deepEqual(lostQueue.stats, { accepted: 1, dropped: 1, completed: 0, failed: 0 })
  assert.equal(lostQueue.stats.accepted,
    lostQueue.stats.completed + lostQueue.stats.failed + lostQueue.stats.dropped)
  assert.equal(lostQueue._slots.every(record => !record.created && !record.pending && record.adapterSlot === null), true)
})
