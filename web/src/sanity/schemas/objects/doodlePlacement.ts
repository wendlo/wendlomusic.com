import { defineField, defineType } from 'sanity';

/**
 * Where a doodle sits on one device. Normally set by dragging in the visual
 * editor (DoodleCanvasInput); the numbers are the fine-tuning fallback.
 * Units match src/lib/doodles.ts (DoodlePlacement).
 */
export const doodlePlacement = defineType({
  name: 'doodlePlacement',
  title: 'Placement',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({ name: 'x', title: 'Across (% from left, centre of item)', type: 'number' }),
    defineField({ name: 'y', title: 'Down (% from top, centre of item)', type: 'number' }),
    defineField({ name: 'w', title: 'Size (% of screen width)', type: 'number' }),
    defineField({ name: 'rot', title: 'Tilt (degrees)', type: 'number', initialValue: 0 }),
    defineField({ name: 'hidden', title: 'Hide on this device', type: 'boolean', initialValue: false }),
  ],
});
