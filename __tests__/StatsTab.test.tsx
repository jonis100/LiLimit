import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest, describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { StatsTab } from '../src/popup/components/StatsTab.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSendMessage = jest.fn<(...args: any[]) => Promise<any>>();

beforeAll(() => {
  (global as unknown as Record<string, unknown>).chrome = {
    runtime: { sendMessage: mockSendMessage },
  };
  global.URL.createObjectURL = jest.fn().mockReturnValue('blob:test') as typeof URL.createObjectURL;
  global.URL.revokeObjectURL = jest.fn() as typeof URL.revokeObjectURL;
});

describe('StatsTab', () => {
  const showMessage = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.URL.createObjectURL as ReturnType<typeof jest.fn>).mockReturnValue('blob:test');
  });

  it('fetches stats when activated', async () => {
    const stats = [{ hostname: 'example.com', visitCount: 3, visitLimit: 5, timeLimit: 30 }];
    mockSendMessage.mockResolvedValueOnce({ stats });

    render(<StatsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'getStats' });
  });

  it('does not fetch when inactive', () => {
    render(<StatsTab isActive={false} showMessage={showMessage} />);
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('shows empty state when stats are empty', async () => {
    mockSendMessage.mockResolvedValueOnce({ stats: [] });
    render(<StatsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => {
      expect(screen.getByText(/no activity yet today/i)).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockSendMessage.mockRejectedValueOnce(new Error('failed'));
    render(<StatsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load stats/i)).toBeInTheDocument();
    });
  });

  it('refetches on refresh click', async () => {
    mockSendMessage.mockResolvedValue({ stats: [] });
    const user = userEvent.setup();
    render(<StatsTab isActive={true} showMessage={showMessage} />);

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /refresh stats/i }));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(2));
  });

  it('shows spinning class on refresh button while fetching', async () => {
    let resolveRefresh!: (v: unknown) => void;
    mockSendMessage
      .mockResolvedValueOnce({ stats: [] })
      .mockReturnValueOnce(new Promise((res) => { resolveRefresh = res; }));

    const user = userEvent.setup();
    render(<StatsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /refresh stats/i }));

    expect(screen.getByRole('button', { name: /refresh stats/i })).toHaveClass('spinning');

    resolveRefresh({ stats: [] });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /refresh stats/i })).not.toHaveClass('spinning');
    });
  });

  it('export button calls showMessage with success', async () => {
    const stats = [{ hostname: 'example.com', visitCount: 1, visitLimit: 5, timeLimit: 30 }];
    mockSendMessage.mockResolvedValueOnce({ stats });
    const user = userEvent.setup();

    render(<StatsTab isActive={true} showMessage={showMessage} />);
    await waitFor(() => screen.getByText('example.com'));

    await user.click(screen.getByRole('button', { name: /export stats/i }));

    expect(showMessage).toHaveBeenCalledWith(expect.stringContaining('exported'));
  });
});
