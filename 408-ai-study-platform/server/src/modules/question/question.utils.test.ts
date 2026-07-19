import { describe, expect, it } from 'vitest';
import { isAnswerCorrect } from './question.utils.js';

describe('isAnswerCorrect', () => {
  it('supports single choice answers', () => {
    expect(isAnswerCorrect('A', 'A')).toBe(true);
    expect(isAnswerCorrect('A', 'B')).toBe(false);
  });

  it('supports unordered multiple choice answers', () => {
    expect(isAnswerCorrect(['A', 'C'], ['C', 'A'])).toBe(true);
    expect(isAnswerCorrect(['A', 'C'], ['A', 'B'])).toBe(false);
  });
});
