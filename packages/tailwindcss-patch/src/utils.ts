export function isObject(val: any) {
  return val !== null && typeof val === 'object' && Array.isArray(val) === false
};
