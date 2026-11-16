import type { Dimension } from './types';

type SeedQ = Omit<Dimension, 'order' | 'active' | 'createdAt' | 'higherIsBetter'> & { higherIsBetter?: boolean };

const r = (a1: string, a3: string, a5: string) => ({ 1: a1, 3: a3, 5: a5 });

/** v1 seed: plan section 13 (18 daily + 6 weekly). */
const SEED: SeedQ[] = [
  { id: 'd1-wellbeing', category: 'Overall wellbeing', question: 'What was my overall wellbeing?', shortLabel: 'Wellbeing', frequency: 'daily', scale: 'rating5', anchors: r('Rough day', 'Okay', 'Great day') },
  { id: 'd2-person', category: 'Overall wellbeing', question: 'Was I the person I want to be?', shortLabel: 'Person I want to be', frequency: 'daily', scale: 'rating5', anchors: r('Not at all', 'Partly', 'Fully') },
  { id: 'd3-partner', category: 'Relationships', question: 'Did I love my partner well?', shortLabel: 'Partner', frequency: 'daily', scale: 'rating5', anchors: r('Neglectful or hurtful', 'Fine, nothing special', 'Intentionally loving') },
  { id: 'd4-stress', category: 'Mental health', question: 'How stressed did I feel?', shortLabel: 'Stress', frequency: 'daily', scale: 'rating5', anchors: r('Calm', 'Noticeable but manageable', 'Overwhelmed'), higherIsBetter: false },
  { id: 'd5-journal', category: 'Mental health', question: 'Did I journal or reflect?', shortLabel: 'Journaled', frequency: 'daily', scale: 'yesno', autoFromNote: true, hint: 'Ticks itself when the day note has a few sentences' },
  { id: 'd6-physical', category: 'Physical health', question: 'How did I feel physically?', shortLabel: 'Physical', frequency: 'daily', scale: 'rating5', anchors: r('Sick or exhausted', 'Normal', 'Energetic and strong') },
  { id: 'd7-sleep-hours', category: 'Physical health', question: 'How many hours did I sleep last night?', shortLabel: 'Sleep hours', frequency: 'daily', scale: 'hours', min: 0, max: 12, step: 0.5, defaultValue: 7 },
  { id: 'd8-sleep-quality', category: 'Physical health', question: 'How well did I sleep last night?', shortLabel: 'Sleep quality', frequency: 'daily', scale: 'rating5', anchors: r('Restless, woke often', 'Average', 'Deep, woke rested') },
  { id: 'd9-eat', category: 'Physical health', question: 'Did I eat healthy?', shortLabel: 'Healthy eating', frequency: 'daily', scale: 'rating5', anchors: r('Poorly', 'Mixed', 'Clean all day') },
  { id: 'd10-workout', category: 'Physical health', question: 'Did I work out?', shortLabel: 'Workout', frequency: 'daily', scale: 'yesno' },
  { id: 'd11-work-enjoy', category: 'Work', question: 'Did I enjoy work?', shortLabel: 'Work enjoyment', frequency: 'daily', scale: 'rating5', anchors: r('Dreaded it', 'Neutral', 'Loved it'), naLabel: 'No work today' },
  { id: 'd12-work-hours', category: 'Work', question: 'How many hours did I work?', shortLabel: 'Work hours', frequency: 'daily', scale: 'hours', min: 0, max: 16, step: 0.5, defaultValue: 8 },
  { id: 'd13-meaning', category: 'Purpose & engagement', question: 'Did I experience meaning?', shortLabel: 'Meaning', frequency: 'daily', scale: 'rating5', anchors: r('Felt pointless', 'Some meaning', 'Deeply meaningful') },
  { id: 'd14-positive', category: 'Purpose & engagement', question: 'Did I experience positive emotions?', shortLabel: 'Positive emotions', frequency: 'daily', scale: 'rating5', anchors: r('Hardly any', 'Some', 'Lots of joy, gratitude, fun') },
  { id: 'd15-engaged', category: 'Purpose & engagement', question: 'Did I feel engaged by what I was doing?', shortLabel: 'Engagement', frequency: 'daily', scale: 'rating5', anchors: r('Bored or distracted', 'Partly', 'Absorbed, in flow') },
  { id: 'd16-achievement', category: 'Achievement & growth', question: 'Did I have a sense of achievement?', shortLabel: 'Achievement', frequency: 'daily', scale: 'rating5', anchors: r('None', 'Some progress', 'Strong sense of accomplishment') },
  { id: 'd17-goals', category: 'Achievement & growth', question: 'Did I achieve my daily goals?', shortLabel: 'Daily goals', frequency: 'daily', scale: 'rating5', anchors: r('None', 'About half', 'All of them'), naLabel: 'No goals set' },
  { id: 'd18-habits', category: 'Character & virtue', question: 'Did I practice the habits I am building?', shortLabel: 'Habits', frequency: 'daily', scale: 'rating5', anchors: r('None', 'Some', 'All of them') },

  { id: 'w1-family', category: 'Relationships', question: 'Did I love my family well?', shortLabel: 'Family', frequency: 'weekly', scale: 'rating5', anchors: r('Neglected them', 'Okay', 'Present and intentional') },
  { id: 'w2-friends', category: 'Relationships', question: 'Did I love my friends well?', shortLabel: 'Friends', frequency: 'weekly', scale: 'rating5', anchors: r('Neglected them', 'Okay', 'Present and intentional') },
  { id: 'w3-service', category: 'Character & virtue', question: 'Was I of service, generous, or did I contribute to my community?', shortLabel: 'Service & community', frequency: 'weekly', scale: 'rating5', anchors: r('Not at all', 'A little', 'Meaningfully') },
  { id: 'w4-finances', category: 'Work', question: 'Was I wise financially?', shortLabel: 'Finances', frequency: 'weekly', scale: 'rating5', anchors: r('Careless or impulsive', 'Okay', 'Intentional, on plan') },
  { id: 'w5-learning', category: 'Achievement & growth', question: 'Was my mind stimulated / did I learn?', shortLabel: 'Learning', frequency: 'weekly', scale: 'rating5', anchors: r('Nothing new', 'Some', 'Learned a lot') },
  { id: 'w6-hobbies', category: 'Entertainment', question: 'Was my engagement in hobbies & entertainment healthy?', shortLabel: 'Hobbies & entertainment', frequency: 'weekly', scale: 'rating5', anchors: r('Mindless scrolling or bingeing', 'Mixed', 'Intentional and restorative') },
];

export function seedDimensions(now = new Date().toISOString()): Dimension[] {
  return SEED.map((q, i) => ({ higherIsBetter: true, ...q, order: (i + 1) * 10, active: true, createdAt: now }));
}
