/* eslint-disable */
require('dotenv').config({ path: '.env.local' });
const { simulateNextRound } = require('./app/actions/calendarActions.ts'); // Wait, calendarActions.ts is a TS file.
// I can't require a TS file directly without ts-node or similar.
