/**
 * Tests for timezone utilities covering offset calculations, labeling, and New Year timing.
 * Uses a fixed system time to ensure deterministic expectations across timezones and DST boundaries.
 */
import { withFakeNow } from '@/test-utils/time-helpers';
import { describe, expect, it } from 'vitest';
import {
    formatOffsetLabel,
    getAllTimezones,
    getTimezoneOffsetMinutes,
    getUserTimezone,
} from './timezone';

const TEST_REFERENCE_DATE = new Date('2025-12-15T12:00:00Z');
const NEW_YEAR_UTC_DATE = new Date('2026-01-01T00:00:00Z');

describe('timezone utilities', () => {
  describe('getUserTimezone', () => {
    it('should return valid IANA timezone string for current environment', async () => {
      await withFakeNow(TEST_REFERENCE_DATE, () => {
        const timezone = getUserTimezone();

        expect(typeof timezone).toBe('string');
        expect(timezone.length).toBeGreaterThan(0);
        expect(timezone === 'UTC' || timezone.includes('/')).toBe(true);
      });
    });

    it('should return UTC when Intl throws an error', async () => {
      await withFakeNow(TEST_REFERENCE_DATE, () => {
        const originalDateTimeFormat = Intl.DateTimeFormat;

        // Mock Intl.DateTimeFormat to throw
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Intl as any).DateTimeFormat = () => {
          throw new Error('Intl not available');
        };

        const result = getUserTimezone();
        expect(result).toBe('UTC');

        // Restore
        Intl.DateTimeFormat = originalDateTimeFormat;
      });
    });

    it('should return UTC when resolvedOptions returns empty timeZone', async () => {
      await withFakeNow(TEST_REFERENCE_DATE, () => {
        const originalDateTimeFormat = Intl.DateTimeFormat;

        // Mock to return empty string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (Intl as any).DateTimeFormat = () => ({
          resolvedOptions: () => ({ timeZone: '' }),
        });

        const result = getUserTimezone();
        expect(result).toBe('UTC');

        // Restore
        Intl.DateTimeFormat = originalDateTimeFormat;
      });
    });
  });

  describe('getAllTimezones', () => {
    it('should return non-empty list when retrieving available timezones', () => {
      const timezones = getAllTimezones();

      expect(Array.isArray(timezones)).toBe(true);
      expect(timezones.length).toBeGreaterThan(0);
    });

    it.each([
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
    ])('should include %s when listing timezones', (timezone) => {
      const timezones = getAllTimezones();

      expect(timezones).toContain(timezone);
    });

    it('should return sorted list when retrieving available timezones', () => {
      const timezones = getAllTimezones();
      const sorted = [...timezones].sort();

      expect(timezones).toEqual(sorted);
    });
  });

  describe('getTimezoneOffsetMinutes', () => {
    it('should return numeric offset when timezone provided', () => {
      const offset = getTimezoneOffsetMinutes('UTC', NEW_YEAR_UTC_DATE);

      expect(typeof offset).toBe('number');
    });

    it.each([
      { timezone: 'UTC', expectedMinutes: 0 },
      { timezone: 'Asia/Tokyo', expectedMinutes: 9 * 60 },
      { timezone: 'America/New_York', expectedMinutes: -5 * 60 },
    ])(
      'should compute $expectedMinutes minutes when timezone is $timezone on Jan 1 2026',
      ({ timezone, expectedMinutes }) => {
        const offset = getTimezoneOffsetMinutes(timezone, NEW_YEAR_UTC_DATE);

        expect(offset).toBe(expectedMinutes);
      }
    );

    it('should return differing offsets for distinct timezones', () => {
      const utcOffset = getTimezoneOffsetMinutes('UTC', NEW_YEAR_UTC_DATE);
      const tokyoOffset = getTimezoneOffsetMinutes('Asia/Tokyo', NEW_YEAR_UTC_DATE);

      expect(tokyoOffset).not.toBe(utcOffset);
    });

    it('should return cached result for repeated calls with same timezone and minute', () => {
      // Call twice with the exact same date - second call should hit cache
      const date = new Date('2026-01-01T12:30:00Z');
      const offset1 = getTimezoneOffsetMinutes('America/New_York', date);
      const offset2 = getTimezoneOffsetMinutes('America/New_York', date);

      expect(offset1).toBe(offset2);
    });

    it('should cache results at minute precision', () => {
      // Two dates in the same minute should return same cached result
      const date1 = new Date('2026-01-01T12:30:00Z');
      const date2 = new Date('2026-01-01T12:30:45Z'); // Same minute, different seconds
      
      const offset1 = getTimezoneOffsetMinutes('Europe/London', date1);
      const offset2 = getTimezoneOffsetMinutes('Europe/London', date2);

      expect(offset1).toBe(offset2);
    });
  });

  describe('formatOffsetLabel', () => {
    it('should return "Your timezone" when timezone matches reference', () => {
      const label = formatOffsetLabel('America/New_York', 'America/New_York', NEW_YEAR_UTC_DATE);

      expect(label).toBe('Your timezone');
    });

    it('should include fractional hours for half-hour offsets', () => {
      const label = formatOffsetLabel('Asia/Kolkata', 'UTC', NEW_YEAR_UTC_DATE);

      expect(label).toBe('+5.5 hours');
    });

    it.each([
      { timezone: 'UTC', reference: 'America/New_York', expected: '+5 hours' },
      { timezone: 'Asia/Tokyo', reference: 'UTC', expected: '+9 hours' },
      { timezone: 'Europe/London', reference: 'Europe/Paris', expected: '-1 hour' },
    ])(
      'should format offset as $expected when comparing $timezone to $reference',
      ({ timezone, reference, expected }) => {
        const label = formatOffsetLabel(timezone, reference, NEW_YEAR_UTC_DATE);

        expect(label).toBe(expected);
      }
    );
  });

});
