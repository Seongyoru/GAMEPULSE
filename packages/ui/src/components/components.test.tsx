import type { PatchChangeRecord } from '@gamepulse/domain';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Countdown, GameFilter } from '../client';
import {
  AdSlot,
  EventCard,
  PatchChange,
  PulseCard,
  RewardBadge,
  SourceAttributionNote,
  StatusChip,
} from '../index';

afterEach(cleanup);

describe('Countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T03:00:00Z')); // 12:00 KST
  });
  afterEach(() => vi.useRealTimers());

  it('renders the absolute target time on the server (stable SSR markup)', () => {
    const html = renderToString(<Countdown target="2026-10-02T05:30:00Z" timeZone="Asia/Seoul" />);
    expect(html).toContain('10.02 (금) 14:30');
    expect(html).toContain('2026-10-02T05:30:00Z');
  });

  it('ticks on the client', () => {
    render(<Countdown target="2026-10-02T05:30:00Z" timeZone="Asia/Seoul" />);
    expect(screen.getByText('02:30:00')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('02:29:59')).toBeTruthy();
  });

  it('uses D-day labels beyond 24 hours and never a time of day for date-only facts', () => {
    render(<Countdown target="2026-10-06T15:00:00Z" timeZone="Asia/Seoul" />);
    expect(screen.getByText('D-5')).toBeTruthy();
    cleanup();
    render(<Countdown target="2026-10-02T15:00:00Z" timeZone="Asia/Seoul" precision="DATE" />);
    expect(screen.getByRole('time').textContent).toBe('D-1');
  });

  it('shows the expired label once the target has passed', () => {
    render(<Countdown target="2026-10-02T02:00:00Z" timeZone="Asia/Seoul" expiredLabel="종료" />);
    expect(screen.getByText('종료')).toBeTruthy();
  });
});

describe('GameFilter', () => {
  const games = [
    { gameId: 'lol', name: '롤', accent: 'sky' as const },
    { gameId: 'genshin', name: '원신', accent: 'teal' as const },
  ];

  it('exposes the selection with aria-pressed and reports toggles', () => {
    const onToggle = vi.fn();
    render(
      <GameFilter games={games} selected={['genshin']} onToggle={onToggle} label="게임 선택" />,
    );
    const group = screen.getByRole('group', { name: '게임 선택' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: '롤' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: '원신' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '롤' }));
    expect(onToggle).toHaveBeenCalledWith('lol');
  });
});

describe('primitives', () => {
  it('RewardBadge shows quantities and collapses overflow', () => {
    render(
      <RewardBadge
        max={2}
        items={[
          { name: '원석', quantity: 1600, unit: null },
          { name: '모라', quantity: 20000, unit: null },
          { name: '영웅의 경험', quantity: 10, unit: '개' },
        ]}
      />,
    );
    expect(screen.getByText('원석')).toBeTruthy();
    expect(screen.getByText('×1,600')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.queryByText('영웅의 경험')).toBeNull();
  });

  it('AdSlot renders nothing when off and reserves space as a placeholder', () => {
    const { container } = render(<AdSlot placement="today" mode="off" />);
    expect(container.innerHTML).toBe('');
    cleanup();
    render(<AdSlot placement="today" mode="placeholder" height={120} />);
    const slot = screen.getByRole('complementary');
    expect(slot.getAttribute('data-ad-placement')).toBe('today');
    expect(slot.style.minHeight).toBe('120px');
  });

  it('StatusChip renders its label', () => {
    render(<StatusChip tone="soon">종료 임박</StatusChip>);
    expect(screen.getByText('종료 임박')).toBeTruthy();
  });

  it('PatchChange shows target, change type and before → after values', () => {
    const change: PatchChangeRecord = {
      targetType: 'CHAMPION',
      targetKey: 'Ahri',
      targetName: '아리',
      changeType: 'BUFF',
      field: 'Q 기본 피해량',
      beforeValue: '80',
      afterValue: '90',
      unit: null,
      description: null,
    };
    const labels = {
      BUFF: '상향',
      NERF: '하향',
      ADJUST: '조정',
      NEW: '신규',
      REMOVED: '삭제',
      REWORK: '리워크',
      FIX: '수정',
      SYSTEM: '시스템',
    };
    render(<PatchChange change={change} typeLabels={labels} />);
    expect(screen.getByText('아리')).toBeTruthy();
    expect(screen.getByText('상향')).toBeTruthy();
    expect(screen.getByLabelText('80에서 90로')).toBeTruthy();
  });
});

describe('EventCard', () => {
  it('shows the period, featured units and rewards, and links to the detail page', () => {
    render(
      <EventCard
        href="/events/genshin-impact-banner-starlight-song-wish"
        title="「별빛의 노래」 기원"
        game={{ gameId: 'genshin', name: '원신', accent: 'teal' }}
        typeLabel="기원"
        status={{ tone: 'live', label: '진행 중' }}
        period="10.01 (목) 10:00 – 10.21 (수) 03:59"
        featured={['가상의 가수', '가상의 기사']}
        rewards={[{ name: '원석', quantity: 160, unit: null }]}
        sample
      />,
    );
    expect(screen.getByRole('link', { name: '「별빛의 노래」 기원' }).getAttribute('href')).toBe(
      '/events/genshin-impact-banner-starlight-song-wish',
    );
    expect(screen.getByText('10.01 (목) 10:00 – 10.21 (수) 03:59')).toBeTruthy();
    expect(screen.getByText('가상의 가수')).toBeTruthy();
    expect(screen.getByText('가상의 기사')).toBeTruthy();
    expect(screen.getByText('진행 중')).toBeTruthy();
    expect(screen.getByText('샘플')).toBeTruthy();
    expect(screen.getByTestId('event-card').getAttribute('data-mg-game')).toBe('genshin');
  });
});

describe('source attribution', () => {
  const NEXON = 'Data based on NEXON Open API';

  it('shows the attribution a source requires on pulse and event cards', () => {
    render(
      <>
        <PulseCard
          href="/notices/maplestory-maintenance-1"
          title="정기 점검 안내"
          game={{ gameId: 'maplestory', name: '메이플', accent: 'orange' }}
          typeLabel="점검"
          attribution={NEXON}
        />
        <EventCard
          href="/events/maplestory-event-1"
          title="가을 이벤트"
          game={{ gameId: 'maplestory', name: '메이플', accent: 'orange' }}
          typeLabel="이벤트"
          status={null}
          period={null}
          attribution={NEXON}
        />
      </>,
    );
    expect(screen.getAllByTestId('source-attribution').map((node) => node.textContent)).toEqual([
      NEXON,
      NEXON,
    ]);
  });

  it('renders nothing when no shown source requires attribution', () => {
    render(
      <>
        <PulseCard
          href="/patches/lol-patch-1"
          title="패치"
          game={{ gameId: 'lol', name: 'LoL', accent: 'sky' }}
          typeLabel="패치"
          attribution={null}
        />
        <SourceAttributionNote attributions={[]} />
      </>,
    );
    expect(screen.queryByTestId('source-attribution')).toBeNull();
  });

  it('lists several attributions once in a compact section note', () => {
    render(<SourceAttributionNote attributions={[NEXON, 'Other source']} />);
    expect(screen.getByTestId('source-attribution').textContent).toBe(`${NEXON} · Other source`);
  });
});
