import { PaintingActivity } from '../activities/painting/PaintingActivity.js';
import { ScreenFillActivity } from '../activities/screen-fill/ScreenFillActivity.js';

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
];

export function getActivityById(id) {
  return activityRegistry.find((a) => a.id === id) || null;
}
