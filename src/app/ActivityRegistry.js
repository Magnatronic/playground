import { PaintingActivity } from '../activities/painting/PaintingActivity.js';
import { ScreenFillActivity } from '../activities/screen-fill/ScreenFillActivity.js';
import { SongActivity } from '../activities/song/SongActivity.js';
import { FreePlayActivity } from '../activities/song/FreePlayActivity.js';

export const activityRegistry = [
  {
    id: 'painting',
    name: 'Collaborative Painting',
    description: 'Paint together on a shared canvas',
    icon: 'brush',
    ActivityClass: PaintingActivity,
    settingsSections: ['sound', 'positionMode', 'effectType', 'effectSettings', 'blendMode', 'actions'],
  },
  {
    id: 'screen-fill',
    name: 'Screen Fill',
    description: 'Fill the screen together',
    icon: 'target',
    ActivityClass: ScreenFillActivity,
    settingsSections: ['sound', 'positionMode', 'fillMode', 'actions'],
  },
  {
    id: 'song',
    name: 'Song Mode',
    description: 'Follow along and play songs together',
    icon: 'music',
    ActivityClass: SongActivity,
    settingsSections: ['soundSong', 'songSelect', 'songMode', 'actionsNoCanvas'],
  },
  {
    id: 'freeplay',
    name: 'Free Play',
    description: 'Play any notes freely with a mist of colour',
    icon: 'music',
    ActivityClass: FreePlayActivity,
    settingsSections: ['soundSong', 'freePlayNotes', 'actionsNoCanvas'],
  },
];

export function getActivityById(id) {
  return activityRegistry.find((a) => a.id === id) || null;
}
