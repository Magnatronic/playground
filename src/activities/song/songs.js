// Frequency constants
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00;

// Switch index → note mapping per song.
// noteMap[switchIndex] = frequency (Hz), or null = switch not used in this song.
// noteNames[switchIndex] = display label ('C', 'D', etc.) shown on the tile.
// steps = sequence of switch indices that make up the melody.
//
// Switch indices: 0=Space, 1=Enter, 2=↑, 3=↓, 4=←, 5=→

export const SONGS = [
  {
    id: 'twinkle',
    name: 'Twinkle Twinkle',
    noteMap:   [C4,   D4,   E4,   F4,   G4,   A4],
    noteNames: ['C',  'D',  'E',  'F',  'G',  'A'],
    steps: [
      0,0,4,4,5,5,4,
      3,3,2,2,1,1,0,
      4,4,3,3,2,2,1,
      4,4,3,3,2,2,1,
      0,0,4,4,5,5,4,
      3,3,2,2,1,1,0,
    ],
  },
  {
    id: 'jingle',
    name: 'Jingle Bells',
    // 5 notes
    noteMap:   [C4,   D4,   E4,   F4,   G4,   null],
    noteNames: ['C',  'D',  'E',  'F',  'G',  ''],
    steps: [
      2,2,2,
      2,2,2,
      2,4,0,1,2,
      3,3,3,2,2,
      2,1,1,2,1,4,
    ],
  },
  {
    id: 'ode',
    name: 'Ode to Joy',
    // 5 notes — very recognisable, good for older students
    noteMap:   [C4,   D4,   E4,   F4,   G4,   null],
    noteNames: ['C',  'D',  'E',  'F',  'G',  ''],
    steps: [
      2,2,3,4,4,3,2,1,
      0,0,1,2,2,1,1,
      2,2,3,4,4,3,2,1,
      0,0,1,2,1,0,0,
    ],
  },
  {
    id: 'saints',
    name: 'When the Saints',
    // 5 notes: C D E G A  (switch 3 unused — no null steps)
    noteMap:   [C4,   D4,   E4,   null, G4,   A4],
    noteNames: ['C',  'D',  'E',  '',   'G',  'A'],
    steps: [
      // Oh when the saints go marching in
      0,2,4,4, 0,2,4,
      // Oh when the saints go marching in
      0,2,4,4, 0,2,4,
      // Oh Lord I want to be in that number
      0,0,0, 5,4,2,0,1,2,
      // When the saints go marching in
      4,2,4,0, 2,1,0,
    ],
  },
];

export function getSongById(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}
