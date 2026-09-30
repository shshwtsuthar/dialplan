import type { Holiday, Rules } from '@dialplan/shared';

// Demo data: Harbor Auto, a fictional car dealership in San Diego. Every
// phone number is in the 555-0100 to 555-0199 range reserved for fiction.

export interface SeedTenant {
  tenantId: string;
  tenantName: string;
  timezone: string;
  numbers: { did: string; name: string; rules: Rules }[];
}

const HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: "New Year's Day" },
  { date: '2026-05-25', name: 'Memorial Day' },
  { date: '2026-07-04', name: 'Independence Day' },
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-11-26', name: 'Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2027-01-01', name: "New Year's Day" },
  { date: '2027-05-31', name: 'Memorial Day' },
  { date: '2027-07-05', name: 'Independence Day (observed)' },
  { date: '2027-09-06', name: 'Labor Day' },
  { date: '2027-11-25', name: 'Thanksgiving' },
  { date: '2027-12-24', name: 'Christmas Day (observed)' },
];

export const HARBOR_AUTO: SeedTenant = {
  tenantId: 'harbor-auto',
  tenantName: 'Harbor Auto',
  timezone: 'America/Los_Angeles',
  numbers: [
    {
      did: '+16195550100',
      name: 'Main line',
      rules: {
        vip: {
          enabled: true,
          callers: [
            { number: '+18585550142', name: 'Dana Whitfield (fleet account)' },
            { number: '+16195550177', name: 'Marcus Lee (repeat buyer)' },
          ],
          destination: { kind: 'extension', target: '201', label: 'Rosa Alvarez, sales manager' },
        },
        holidays: {
          enabled: true,
          dates: HOLIDAYS,
          destination: { kind: 'voicemail', target: 'holiday', label: 'Holiday greeting' },
        },
        hours: {
          enabled: true,
          weekly: {
            mon: [{ open: '08:00', close: '18:00' }],
            tue: [{ open: '08:00', close: '18:00' }],
            wed: [{ open: '08:00', close: '18:00' }],
            thu: [{ open: '08:00', close: '18:00' }],
            fri: [{ open: '08:00', close: '18:00' }],
            sat: [{ open: '09:00', close: '17:00' }],
            sun: [],
          },
          destination: { kind: 'ring_group', target: 'sales', label: 'Sales floor' },
        },
        afterHours: {
          destination: { kind: 'external', target: '+16195550199', label: 'Answering service' },
        },
      },
    },
    {
      did: '+16195550150',
      name: 'Service department',
      rules: {
        vip: {
          enabled: true,
          callers: [{ number: '+18585550142', name: 'Dana Whitfield (fleet account)' }],
          destination: { kind: 'extension', target: '310', label: 'Fleet service desk' },
        },
        holidays: {
          enabled: true,
          dates: HOLIDAYS,
          destination: { kind: 'voicemail', target: 'holiday', label: 'Holiday greeting' },
        },
        hours: {
          enabled: true,
          weekly: {
            mon: [{ open: '07:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
            tue: [{ open: '07:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
            wed: [{ open: '07:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
            thu: [{ open: '07:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
            fri: [{ open: '07:00', close: '12:00' }, { open: '13:00', close: '18:00' }],
            sat: [{ open: '08:00', close: '14:00' }],
            sun: [],
          },
          destination: { kind: 'ring_group', target: 'service', label: 'Service advisors' },
        },
        afterHours: {
          destination: { kind: 'voicemail', target: 'service', label: 'Service voicemail' },
        },
      },
    },
  ],
};
