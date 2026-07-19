const normalizeAnswer = (answer: unknown) => {
  if (Array.isArray(answer)) return [...answer].map(String).sort();
  return [String(answer)];
};

export const isAnswerCorrect = (standardAnswer: unknown, userAnswer: unknown) => {
  const expected = normalizeAnswer(standardAnswer);
  const actual = normalizeAnswer(userAnswer);
  return expected.length === actual.length && expected.every((item, index) => item === actual[index]);
};
