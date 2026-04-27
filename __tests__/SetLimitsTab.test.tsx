import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { SetLimitsTab } from '../src/popup/components/SetLimitsTab.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendMessage = jest.fn<(...args: any[]) => Promise<any>>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockTabsQuery = jest.fn<(...args: any[]) => Promise<any>>();

beforeAll(() => {
  (global as unknown as Record<string, unknown>).chrome = {
    runtime: { sendMessage: mockSendMessage },
    tabs: { query: mockTabsQuery },
  };
});

describe('SetLimitsTab', () => {
  const showMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMessage.mockResolvedValue({});
  });

  it('shows "No limits applied" when both fields are empty', async () => {
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.click(screen.getByRole('button', { name: /set limit/i }));

    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('No limits applied'));
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('sends setTimeLimit only when time limit is set', async () => {
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.type(screen.getByLabelText(/time limit/i), '30');
    await user.click(screen.getByRole('button', { name: /set limit/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setTimeLimit', hostname: 'example.com' })
      );
    });
    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setVisitLimit' })
    );
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('30 minutes'));
  });

  it('sends setVisitLimit only when visit limit is set', async () => {
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.type(screen.getByLabelText(/visit limit/i), '5');
    await user.click(screen.getByRole('button', { name: /set limit/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setVisitLimit', hostname: 'example.com' })
      );
    });
    expect(mockSendMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setTimeLimit' })
    );
    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('5 visits'));
  });

  it('sends both messages when both limits are set', async () => {
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.type(screen.getByLabelText(/time limit/i), '30');
    await user.type(screen.getByLabelText(/visit limit/i), '5');
    await user.click(screen.getByRole('button', { name: /set limit/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setTimeLimit' })
      );
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'setVisitLimit' })
      );
    });
    await waitFor(() => {
      expect(showMessage).toHaveBeenCalledWith(
        expect.stringContaining('30 minutes')
      );
    });
  });

  it('shows error message when sendMessage throws', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('background unavailable'));
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.type(screen.getByLabelText(/time limit/i), '30');
    await user.click(screen.getByRole('button', { name: /set limit/i }));

    await waitFor(() => {
      expect(showMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.any(Number),
        true
      );
    });
  });

  it('calls deLimit and shows success message on delete', async () => {
    mockSendMessage.mockResolvedValueOnce({ success: true });
    jest.spyOn(window, 'confirm').mockReturnValueOnce(true);
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.click(screen.getByRole('button', { name: /delete limit/i }));

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deLimit', hostname: 'example.com' })
      );
      expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('removed'));
    });
  });

  it('does not call deLimit when delete is cancelled', async () => {
    jest.spyOn(window, 'confirm').mockReturnValueOnce(false);
    const user = userEvent.setup();
    render(<SetLimitsTab isActive={true} showMessage={showMessage} />);

    await user.type(screen.getByLabelText(/website/i), 'example.com');
    await user.click(screen.getByRole('button', { name: /delete limit/i }));

    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
