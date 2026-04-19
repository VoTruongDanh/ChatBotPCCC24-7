// Build prompt từ rules và user message

export function buildPrompt(rules, userMessage) {
  if (!rules || rules.length === 0) {
    return userMessage;
  }

  const systemRules      = rules.filter(r => r.type === 'system');
  const contextRules     = rules.filter(r => r.type === 'context');
  const instructionRules = rules.filter(r => r.type === 'instruction');

  let prompt = '';

  if (systemRules.length > 0) {
    prompt += '=== VAI TRÒ ===\n';
    systemRules.forEach(r => { prompt += r.content + '\n\n'; });
  }

  if (contextRules.length > 0) {
    prompt += '=== KIẾN THỨC PCCC ===\n';
    contextRules.forEach(r => { prompt += r.content + '\n\n'; });
  }

  if (instructionRules.length > 0) {
    prompt += '=== HƯỚNG DẪN ===\n';
    instructionRules.forEach(r => { prompt += r.content + '\n\n'; });
  }

  prompt += '=== CÂU HỎI ===\n' + userMessage;

  return prompt;
}
