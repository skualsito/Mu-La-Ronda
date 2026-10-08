import { describe, expect, it } from 'vitest';
import { validateSurvey } from './surveyRules';

const game = { speed: 'fast', drop: 'medium', resets: 'yes', focus: 'mixed', often: 'daily' };
const staffAnswers = { knowledge: '3', version: 's6', years: 12, discord: 'skual' };

describe('validateSurvey', () => {
  it('takes a full answer without staff', () => {
    const result = validateSurvey({ game: { ...game, events: ['bc', 'cc'], extra: '  más eventos  ' }, staff: false });
    expect(result).toEqual({
      ok: true,
      answers: { staff: false, game: { ...game, events: ['bc', 'cc'], extra: 'más eventos' }, staffAnswers: null },
    });
  });

  it('asks for the required questions', () => {
    const result = validateSurvey({ game: { ...game, speed: undefined } });
    expect(result.ok).toBe(false);
  });

  it('refuses a choice that is not on the list', () => {
    expect(validateSurvey({ game: { ...game, speed: 'x9999' } }).ok).toBe(false);
    expect(validateSurvey({ game: { ...game, events: ['bc', 'nope'] } }).ok).toBe(false);
  });

  it('caps the free text', () => {
    expect(validateSurvey({ game: { ...game, extra: 'a'.repeat(501) } }).ok).toBe(false);
    expect(validateSurvey({ game: { ...game, extra: 'a'.repeat(500) } }).ok).toBe(true);
  });

  it('drops keys it does not know', () => {
    const result = validateSurvey({ game: { ...game, admin: true }, staff: false });
    expect(result.ok && 'admin' in result.answers.game).toBe(false);
  });

  it('checks the staff part only when staff is ticked', () => {
    expect(validateSurvey({ game, staff: true, staffAnswers: { ...staffAnswers, discord: '' } }).ok).toBe(false);
    expect(validateSurvey({ game, staff: true, staffAnswers: { ...staffAnswers, years: 99 } }).ok).toBe(false);
    const ok = validateSurvey({ game, staff: true, staffAnswers: { ...staffAnswers, roles: ['gm', 'spots'] } });
    expect(ok.ok && ok.answers.staffAnswers).toEqual({ ...staffAnswers, roles: ['gm', 'spots'] });
    const ignored = validateSurvey({ game, staff: false, staffAnswers: { discord: '' } });
    expect(ignored.ok && ignored.answers.staffAnswers).toBe(null);
  });

  it('keeps line breaks only where the answer is multiline', () => {
    const result = validateSurvey({
      game: { ...game, extra: 'uno\r\ndos' },
      staff: true,
      staffAnswers: { ...staffAnswers, discord: 'a\nb' },
    });
    expect(result.ok && result.answers.game.extra).toBe('uno\ndos');
    expect(result.ok && result.answers.staffAnswers?.discord).toBe('a b');
  });
});
