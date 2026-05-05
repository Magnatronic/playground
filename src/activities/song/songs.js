// Frequency constants
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00;
const Bb4 = 466.16;

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
    id: 'happy-birthday',
    name: 'Happy Birthday',
    // 6 notes: C D E F G A  (Bb dropped — A appears 3x vs Bb 2x)
    noteMap:   [C4,   D4,   E4,   F4,   G4,   A4],
    noteNames: ['C',  'D',  'E',  'F',  'G',  'A'],
    steps: [
      // Happy birthday to you  (C C D C F E)
      0,0,1,0,3,2,
      // Happy birthday to you  (C C D C G F)
      0,0,1,0,4,3,
      // Happy birthday dear [name]  (C C C A F E D — low C used for high C)
      0,0,0,5,3,2,1,
      // Happy birthday to you  (A A A F G F — A used in place of Bb)
      5,5,5,3,4,3,
    ],
  },
  {
    id: 'row',
    name: 'Row Row Row Your Boat',
    // 4 notes: C E G A
    noteMap:   [C4,   null, E4,   null, G4,   A4],
    noteNames: ['C',  '',   'E',  '',   'G',  'A'],
    steps: [
      // Row row row your boat
      0,0,0,2,4,
      // gently down the stream
      4,2,4,5,
      // merrily merrily merrily merrily
      4,4,4,4, 4,4,4,4,
      // life is but a dream
      5,5,4,4,2,2,0,
    ],
  },
  {
    id: 'frere',
    name: 'Frère Jacques',
    // 6 notes: C D E F G A
    noteMap:   [C4,   D4,   E4,   F4,   G4,   A4],
    noteNames: ['C',  'D',  'E',  'F',  'G',  'A'],
    steps: [
      // Frère Jacques, Frère Jacques
      0,1,2,0, 0,1,2,0,
      // Dormez-vous? Dormez-vous?
      2,3,4, 2,3,4,
      // Sonnez les matines! Sonnez les matines!
      4,5,4,3,2,0, 4,5,4,3,2,0,
      // Din din don, din din don
      0,3,4, 0,3,4,
    ],
  },
  {
    id: 'sunshine',
    name: 'You Are My Sunshine',
    // 5 notes: C D E G A
    noteMap:   [C4,   D4,   E4,   null, G4,   A4],
    noteNames: ['C',  'D',  'E',  '',   'G',  'A'],
    steps: [
      // You are my sunshine
      4,4,2,4,5,4,
      // my only sunshine
      5,4,2,4,2,
      // you make me happy
      4,5,4,2,0,
      // when skies are grey
      0,1,2,4,2,
      // you'll never know dear
      4,4,2,4,5,4,
      // how much I love you
      4,2,1,2,4,
      // please don't take my sunshine away
      4,4,5,4,2,4,2,0,
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
    // 4 notes: C E F G — switches 0(C), 2(E), 3(F), 4(G)
    noteMap:   [C4,   null, E4,   F4,   G4,   null],
    noteNames: ['C',  '',   'E',  'F',  'G',  ''],
    steps: [
      // Oh when the saints go marching in
      0,2,3,4, 0,2,3,4,
      // Oh when the saints go marching in
      0,2,3,4, 0,2,3,4,
      // Oh Lord I want to be in that number
      4,4,3,4,4,3,2,0,2,3,
      // When the saints go marching in
      4,3,4,0, 3,2,0,
    ],
  },
];

export function getSongById(id) {
  return SONGS.find((s) => s.id === id) || SONGS[0];
}
