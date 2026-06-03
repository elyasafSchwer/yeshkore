export function usernameToEmail(username: string): string {
  const hex = Array.from(username)
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0'))
    .join('');
  return `${hex}@users.yeshkore.app`;
}

const VALID_USERNAME = /^[֐-׿a-zA-Z0-9_]+$/;

export function isValidUsername(username: string): boolean {
  return username.length >= 2 && VALID_USERNAME.test(username);
}
