# Gutenberg Block Unit Testing Guide

## 1. Testing `edit.js` with a Stateful Test Harness

The `edit` component renders the interactive editor interface for a block. While a simple spy (`jest.fn()` / `vi.fn()`) on `setAttributes` can verify that an event handler called the update function, it fails to model realistic re-rendering and prop updates.

### The Stateful Test Harness Pattern
Wrap the block component in a small test harness that maintains state and updates `attributes`:

```jsx
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalloutEdit from '../src/blocks/callout/edit';

function BlockHarness({ initialAttributes = {}, onAttributesChange }) {
  const [attributes, setAttributesState] = useState(initialAttributes);

  const setAttributes = (newAttrs) => {
    setAttributesState((prev) => {
      const merged = { ...prev, ...newAttrs };
      if (onAttributesChange) onAttributesChange(merged);
      return merged;
    });
  };

  return <CalloutEdit attributes={attributes} setAttributes={setAttributes} />;
}

test('updates block title and reflects state in DOM', async () => {
  const user = userEvent.setup();
  render(<BlockHarness initialAttributes={{ title: 'Initial' }} />);

  const input = screen.getByRole('textbox', { name: 'Title' });
  await user.clear(input);
  await user.type(input, 'Updated Title');

  expect(input).toHaveValue('Updated Title');
});
```

---

## 2. Testing `save.js`
The `save` component returns the static serialized HTML.
- Execute `save({ attributes })` or render it with `@testing-library/react`.
- Assert semantic DOM structure using `container.querySelector(...)` or `toHaveTextContent(...)`.
- Avoid full-string snapshot tests (`toMatchSnapshot()`) if classes or minor wrapper attributes frequently drift.
