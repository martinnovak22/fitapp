const assert = require('node:assert/strict')
const { buildSetPayload } = require('../src/modules/workout/setPayload')

const weightResult = buildSetPayload({
    exerciseType: 'weight',
    inputValues: {
        weight: '100',
        reps: '5',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    },
    subSets: [],
})

assert.equal(weightResult.hasAnyData, true)
assert.equal(weightResult.data.weight, 100)
assert.equal(weightResult.data.reps, 5)
assert.equal(weightResult.data.distance, undefined)

const cardioDurationResult = buildSetPayload({
    exerciseType: 'cardio',
    inputValues: {
        weight: '',
        reps: '',
        distance: '1200',
        durationMinutes: '2',
        durationSeconds: '30',
    },
    subSets: [],
})

assert.equal(cardioDurationResult.hasAnyData, true)
assert.equal(cardioDurationResult.data.distance, 1200)
assert.equal(cardioDurationResult.data.duration, 2.5)

const emptyResult = buildSetPayload({
    exerciseType: 'bodyweight',
    inputValues: {
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    },
    subSets: [{ weight: 0, reps: 0 }],
})

assert.equal(emptyResult.hasAnyData, false)
assert.equal(emptyResult.data.sub_sets, undefined)

const subSetResult = buildSetPayload({
    exerciseType: 'weight',
    inputValues: {
        weight: '',
        reps: '',
        distance: '',
        durationMinutes: '',
        durationSeconds: '',
    },
    subSets: [
        { weight: 80, reps: 8 },
        { weight: 0, reps: 0 },
    ],
})

assert.equal(subSetResult.hasAnyData, true)
assert.equal(subSetResult.hasSubSets, true)
assert.equal(subSetResult.data.sub_sets, JSON.stringify([{ weight: 80, reps: 8 }]))

console.log('test-build-set-payload: OK')
