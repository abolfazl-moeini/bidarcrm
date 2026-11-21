/**
 * @jest-environment node
 */
// @vitest-environment node

/**
 * Pure Domain Business Logic: Price & Discount Calculator.
 * Executable in a pure Node.js environment without any JSDOM or browser dependencies.
 */
function calculateDiscountedTotal(items, discountPercent = 0) {
  if (!Array.isArray(items)) {
    throw new TypeError('Expected items to be an array');
  }

  const subtotal = items.reduce((acc, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 1;
    return acc + price * qty;
  }, 0);

  const safeDiscount = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  const discountAmount = (subtotal * safeDiscount) / 100;
  const total = Math.max(0, subtotal - discountAmount);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

describe('Pure Domain Logic: calculateDiscountedTotal (Node Environment)', () => {
  it('runs in a pure Node environment without DOM globals', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('calculates subtotal and total without discounts correctly', () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 25, quantity: 1 },
    ];
    const result = calculateDiscountedTotal(items);
    expect(result).toEqual({
      subtotal: 45,
      discountAmount: 0,
      total: 45,
    });
  });

  it('applies percentage discount properly within 0-100 bounds', () => {
    const items = [{ price: 100, quantity: 1 }];
    const result = calculateDiscountedTotal(items, 20);
    expect(result).toEqual({
      subtotal: 100,
      discountAmount: 20,
      total: 80,
    });
  });

  it('clamps invalid discount percentages', () => {
    const items = [{ price: 50, quantity: 1 }];
    expect(calculateDiscountedTotal(items, -10).total).toBe(50);
    expect(calculateDiscountedTotal(items, 150).total).toBe(0);
  });

  it('throws TypeError if items is not an array', () => {
    expect(() => calculateDiscountedTotal(null)).toThrow(TypeError);
  });
});
