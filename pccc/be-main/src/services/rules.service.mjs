import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RULES_FILE = path.join(__dirname, '../../data/rules.json');

// Đọc tất cả rules
export function getAllRules() {
  try {
    const data = fs.readFileSync(RULES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Lấy rules đang active, sắp xếp theo priority
export function getActiveRules() {
  const rules = getAllRules();
  return rules
    .filter(r => r.active)
    .sort((a, b) => a.priority - b.priority);
}

// Lấy rule theo id
export function getRuleById(id) {
  const rules = getAllRules();
  return rules.find(r => r.id === id) || null;
}

// Tạo rule mới
export function createRule(ruleData) {
  const rules = getAllRules();
  const newRule = {
    id: `rule-${Date.now()}`,
    name: ruleData.name,
    type: ruleData.type || 'instruction',
    content: ruleData.content,
    priority: ruleData.priority || 10,
    active: ruleData.active ?? true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  rules.push(newRule);
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  return newRule;
}

// Cập nhật rule
export function updateRule(id, updates) {
  const rules = getAllRules();
  const index = rules.findIndex(r => r.id === id);
  if (index === -1) return null;

  rules[index] = {
    ...rules[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  return rules[index];
}

// Xóa rule
export function deleteRule(id) {
  const rules = getAllRules();
  const index = rules.findIndex(r => r.id === id);
  if (index === -1) return false;

  rules.splice(index, 1);
  fs.writeFileSync(RULES_FILE, JSON.stringify(rules, null, 2));
  return true;
}

// Build prompt từ rules
export function buildPromptFromRules(userMessage) {
  const rules = getActiveRules();
  
  const systemRules = rules.filter(r => r.type === 'system');
  const contextRules = rules.filter(r => r.type === 'context');
  const instructionRules = rules.filter(r => r.type === 'instruction');

  let prompt = '';

  if (systemRules.length > 0) {
    prompt += '=== VAI TRÒ ===\n';
    systemRules.forEach(r => {
      prompt += r.content + '\n\n';
    });
  }

  if (contextRules.length > 0) {
    prompt += '=== KIẾN THỨC PCCC ===\n';
    contextRules.forEach(r => {
      prompt += r.content + '\n\n';
    });
  }

  if (instructionRules.length > 0) {
    prompt += '=== HƯỚNG DẪN ===\n';
    instructionRules.forEach(r => {
      prompt += r.content + '\n\n';
    });
  }

  prompt += '=== CÂU HỎI ===\n' + userMessage;

  return prompt;
}
