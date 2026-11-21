import React, { useState, StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Example Gutenberg Block Edit Component in Vitest.
 */
function CalloutEdit({ attributes, setAttributes }) {
  const { title = '', isNotice = false } = attributes;

  return (
    <div className="wp-block-my-plugin-callout" data-testid="callout-block">
      <input
        type="text"
        role="textbox"
        aria-label="Callout Title"
        value={title}
        onChange={(e) => setAttributes({ title: e.target.value })}
      />
      <label>
        <input
          type="checkbox"
          role="checkbox"
          checked={isNotice}
          onChange={(e) => setAttributes({ isNotice: e.target.checked })}
        />
        Display as prominent notice
      </label>
      <div className="preview">
        <h4>{title || 'Default Title'}</h4>
        {isNotice && <span className="badge">Notice</span>}
      </div>
    </div>
  );
}

/**
 * Stateful Test Harness: models realistic Gutenberg block state updates.
 * Keeps side-effects outside the state updater function to ensure StrictMode safety.
 */
function BlockHarness({ initialAttributes = {}, onAttributesChange }) {
  const [attributes, setAttributesState] = useState(initialAttributes);

  const setAttributes = (newAttrs) => {
    const merged = { ...attributes, ...newAttrs };
    setAttributesState(merged);
    if (onAttributesChange) {
      onAttributesChange(merged);
    }
  };

  return <CalloutEdit attributes={attributes} setAttributes={setAttributes} />;
}

describe('Gutenberg Block Edit: CalloutEdit (Vitest)', () => {
  it('renders initial attributes and updates preview via stateful harness', async () => {
    const user = userEvent.setup();
    const handleAttrsChange = vi.fn();

    render(
      <BlockHarness
        initialAttributes={{ title: 'Welcome to WordPress', isNotice: false }}
        onAttributesChange={handleAttrsChange}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Callout Title' });
    const checkbox = screen.getByRole('checkbox');

    expect(input).toHaveValue('Welcome to WordPress');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Welcome to WordPress');

    // Simulate user editing title
    await user.clear(input);
    await user.type(input, 'New Callout Header');

    expect(input).toHaveValue('New Callout Header');
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('New Callout Header');
    expect(handleAttrsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'New Callout Header' })
    );

    // Simulate user toggling notice checkbox
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByText('Notice')).toBeInTheDocument();
    expect(handleAttrsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: 'New Callout Header',
        isNotice: true,
      })
    );
  });

  it('safely handles React StrictMode double invocations without duplicate side-effects', async () => {
    const user = userEvent.setup();
    const handleAttrsChange = vi.fn();

    render(
      <StrictMode>
        <BlockHarness
          initialAttributes={{ title: 'Strict Mode Title', isNotice: false }}
          onAttributesChange={handleAttrsChange}
        />
      </StrictMode>
    );

    const input = screen.getByRole('textbox', { name: 'Callout Title' });
    await user.clear(input);
    await user.type(input, 'A');

    // Exactly one change event trigger per keystroke
    expect(handleAttrsChange).toHaveBeenCalledTimes(2); // 1 for clear, 1 for 'A'
  });

  it('unmounts cleanly without throwing memory or lifecycle warnings', () => {
    const { unmount } = render(
      <BlockHarness initialAttributes={{ title: 'Clean Unmount', isNotice: false }} />
    );
    expect(() => unmount()).not.toThrow();
  });
});
