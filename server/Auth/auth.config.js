export const ADMIN_EMAILS = [
  'justin.m.lee.dev@gmail.com',
  'cranapplellc@gmail.com',
  'vl@black.com',
  'sackjulisa@gmail.com',
  'alexuvaro00@gmail.com',
  'kevinpuxingzhou@gmail.com',
  'antonloth79028@gmail.com'
];

export const COMMENT_BOT_CREDIT_PRICE = 3.00;
export const BC_GEN_CREDIT_PRICE = 2.00;
export const VIRTUAL_ASSISTANT_CREDIT_PRICE = 50.00;

export function isAdminUser(userEmail) {
  return ADMIN_EMAILS.includes(userEmail);
}